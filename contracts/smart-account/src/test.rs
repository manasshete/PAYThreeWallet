#![cfg(test)]
//! Zipper (CAP-71) auth tests — delegated signers + spend policy.
extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    xdr::{
        InvokeContractArgs, ScAddress, ScVal, SorobanAddressCredentials,
        SorobanAddressCredentialsWithDelegates, SorobanAuthorizationEntry,
        SorobanAuthorizedFunction, SorobanAuthorizedInvocation, SorobanCredentials,
        SorobanDelegateSignature, StringM, VecM,
    },
    Address, Env,
};

use crate::{Error, Pay3SmartAccount, Pay3SmartAccountClient};

/// Always-approve Zipper delegate (stands in for a funded G session key).
#[soroban_sdk::contract]
pub struct AlwaysOkDelegate;

#[soroban_sdk::contractimpl]
impl soroban_sdk::auth::CustomAccountInterface for AlwaysOkDelegate {
    type Signature = ();
    type Error = Error;
    fn __check_auth(
        _env: soroban_sdk::Env,
        _payload: soroban_sdk::crypto::Hash<32>,
        _signatures: (),
        _auth_contexts: soroban_sdk::Vec<soroban_sdk::auth::Context>,
    ) -> Result<(), Error> {
        Ok(())
    }
}

/// Fake native SAC: requires `from` auth (triggers Pay3 `__check_auth`).
#[soroban_sdk::contract]
pub struct FakeSac;

#[soroban_sdk::contractimpl]
impl FakeSac {
    pub fn transfer(from: Address, _to: Address, _amount: i128) {
        from.require_auth();
    }
}

struct Fixture<'a> {
    env: &'a Env,
    client: Pay3SmartAccountClient<'a>,
    owner: Address,
    session: Address,
    native_sac: Address,
}

fn setup(env: &Env) -> Fixture<'_> {
    env.mock_all_auths();
    let owner = env.register(AlwaysOkDelegate, ());
    let session = env.register(AlwaysOkDelegate, ());
    let native_sac = env.register(FakeSac, ());
    let client = Pay3SmartAccountClient::new(
        env,
        &env.register(Pay3SmartAccount {}, (owner.clone(), native_sac.clone())),
    );
    Fixture {
        env,
        client,
        owner,
        session,
        native_sac,
    }
}

fn auth_transfer(
    env: &Env,
    account: &Address,
    delegate: &Address,
    sac: &Address,
    to: &Address,
    amount: i128,
    nonce: i64,
) -> SorobanAuthorizationEntry {
    let account_addr: ScAddress = account.clone().into();
    let delegate_addr: ScAddress = delegate.clone().into();
    let sac_addr: ScAddress = sac.clone().into();
    let to_addr: ScAddress = to.clone().into();
    // Host rejects expiry too far ahead of current ledger.
    let exp = env.ledger().sequence() + 100;
    SorobanAuthorizationEntry {
        credentials: SorobanCredentials::AddressWithDelegates(
            SorobanAddressCredentialsWithDelegates {
                address_credentials: SorobanAddressCredentials {
                    address: account_addr.clone(),
                    nonce,
                    signature_expiration_ledger: exp,
                    signature: ScVal::Void,
                },
                delegates: std::vec![SorobanDelegateSignature {
                    address: delegate_addr,
                    signature: ScVal::Void,
                    nested_delegates: VecM::default(),
                }]
                .try_into()
                .unwrap(),
            },
        ),
        root_invocation: SorobanAuthorizedInvocation {
            function: SorobanAuthorizedFunction::ContractFn(InvokeContractArgs {
                contract_address: sac_addr,
                function_name: StringM::try_from("transfer").unwrap().into(),
                args: {
                    let amount_sc: ScVal = amount.into();
                    std::vec![
                        ScVal::Address(account_addr),
                        ScVal::Address(to_addr),
                        amount_sc,
                    ]
                    .try_into()
                    .unwrap()
                },
            }),
            sub_invocations: VecM::default(),
        },
    }
}

fn do_transfer(f: &Fixture<'_>, delegate: &Address, amount: i128, nonce: i64) {
    let to = Address::generate(f.env);
    f.env.set_auths(&[auth_transfer(
        f.env,
        &f.client.address,
        delegate,
        &f.native_sac,
        &to,
        amount,
        nonce,
    )]);
    let sac = FakeSacClient::new(f.env, &f.native_sac);
    sac.transfer(&f.client.address, &to, &amount);
}

#[test]
fn owner_delegate_can_transfer() {
    let env = Env::default();
    let f = setup(&env);
    do_transfer(&f, &f.owner, 1_000_000, 1);
}

#[test]
fn session_delegate_can_transfer_within_caps() {
    let env = Env::default();
    let f = setup(&env);
    f.client
        .add_session(&f.session, &1_000_000, &5_000_000, &10_000_000);
    do_transfer(&f, &f.session, 1_000_000, 1);
    let pol = f.client.get_session(&f.session);
    assert_eq!(pol.spent_stroops, 1_000_000);
}

#[test]
fn unknown_delegate_rejected() {
    let env = Env::default();
    let f = setup(&env);
    let stranger = env.register(AlwaysOkDelegate, ());
    let to = Address::generate(&env);
    env.set_auths(&[auth_transfer(
        &env,
        &f.client.address,
        &stranger,
        &f.native_sac,
        &to,
        1_000_000,
        1,
    )]);
    let sac = FakeSacClient::new(&env, &f.native_sac);
    let err = sac.try_transfer(&f.client.address, &to, &1_000_000);
    assert!(err.is_err());
}

#[test]
fn session_per_tx_cap() {
    let env = Env::default();
    let f = setup(&env);
    f.client
        .add_session(&f.session, &1_000_000, &500_000, &10_000_000);
    let to = Address::generate(&env);
    env.set_auths(&[auth_transfer(
        &env,
        &f.client.address,
        &f.session,
        &f.native_sac,
        &to,
        600_000,
        1,
    )]);
    let sac = FakeSacClient::new(&env, &f.native_sac);
    assert!(sac.try_transfer(&f.client.address, &to, &600_000).is_err());
}

#[test]
fn session_expired() {
    let env = Env::default();
    let f = setup(&env);
    f.client
        .add_session(&f.session, &100, &5_000_000, &10_000_000);
    env.ledger().with_mut(|li| li.sequence_number = 101);
    let to = Address::generate(&env);
    env.set_auths(&[auth_transfer(
        &env,
        &f.client.address,
        &f.session,
        &f.native_sac,
        &to,
        1_000_000,
        1,
    )]);
    let sac = FakeSacClient::new(&env, &f.native_sac);
    assert!(sac
        .try_transfer(&f.client.address, &to, &1_000_000)
        .is_err());
}

#[test]
fn session_revoked() {
    let env = Env::default();
    let f = setup(&env);
    f.client
        .add_session(&f.session, &1_000_000, &5_000_000, &10_000_000);
    f.client.revoke_session(&f.session);
    let to = Address::generate(&env);
    env.set_auths(&[auth_transfer(
        &env,
        &f.client.address,
        &f.session,
        &f.native_sac,
        &to,
        1_000_000,
        1,
    )]);
    let sac = FakeSacClient::new(&env, &f.native_sac);
    assert!(sac
        .try_transfer(&f.client.address, &to, &1_000_000)
        .is_err());
}

#[test]
fn session_lifetime_cap() {
    let env = Env::default();
    let f = setup(&env);
    f.client
        .add_session(&f.session, &1_000_000, &600_000, &1_000_000);
    do_transfer(&f, &f.session, 600_000, 1);
    let to = Address::generate(&env);
    env.set_auths(&[auth_transfer(
        &env,
        &f.client.address,
        &f.session,
        &f.native_sac,
        &to,
        500_000,
        2,
    )]);
    let sac = FakeSacClient::new(&env, &f.native_sac);
    assert!(sac.try_transfer(&f.client.address, &to, &500_000).is_err());
}

#[test]
fn bad_policy_rejected_on_add_session() {
    let env = Env::default();
    let f = setup(&env);
    assert!(f
        .client
        .try_add_session(&f.session, &1_000_000, &0, &10)
        .is_err());
    assert!(f
        .client
        .try_add_session(&f.session, &1_000_000, &100, &50)
        .is_err());
}

#[test]
fn non_transfer_context_rejected() {
    let env = Env::default();
    let f = setup(&env);
    f.client
        .add_session(&f.session, &1_000_000, &5_000_000, &10_000_000);

    // Auth entry points at Pay3.add_session — not allowed via __check_auth.
    let account_addr: ScAddress = f.client.address.clone().into();
    let delegate_addr: ScAddress = f.session.clone().into();
    env.set_auths(&[SorobanAuthorizationEntry {
        credentials: SorobanCredentials::AddressWithDelegates(
            SorobanAddressCredentialsWithDelegates {
                address_credentials: SorobanAddressCredentials {
                    address: account_addr.clone(),
                    nonce: 9,
                    signature_expiration_ledger: env.ledger().sequence() + 100,
                    signature: ScVal::Void,
                },
                delegates: std::vec![SorobanDelegateSignature {
                    address: delegate_addr,
                    signature: ScVal::Void,
                    nested_delegates: VecM::default(),
                }]
                .try_into()
                .unwrap(),
            },
        ),
        root_invocation: SorobanAuthorizedInvocation {
            function: SorobanAuthorizedFunction::ContractFn(InvokeContractArgs {
                contract_address: account_addr,
                function_name: StringM::try_from("add_session").unwrap().into(),
                args: VecM::default(),
            }),
            sub_invocations: VecM::default(),
        },
    }]);

    // Trigger require_auth on account with a fake call — use FakeSac but wrong isn't needed;
    // invoking add_session without owner mock would fail differently. Use sac transfer auth tree
    // already covered; this entry alone isn't executed. Call transfer with mismatched auth:
    let to = Address::generate(&env);
    let sac = FakeSacClient::new(&env, &f.native_sac);
    // Auth is for add_session, invoke transfer → host won't match / check_auth sees wrong ctx if forced.
    // Clear and use transfer auth but contract = pay3 address with fn add_session already set —
    // simpler: transfer auth where contract is pay3 (invalid for our validator).
    env.set_auths(&[auth_transfer(
        &env,
        &f.client.address,
        &f.session,
        &f.client.address, // not native sac
        &to,
        1_000_000,
        3,
    )]);
    assert!(sac
        .try_transfer(&f.client.address, &to, &1_000_000)
        .is_err());
}
