import Image from "next/image";

export function Pay3Logo({
  className = "",
  size = 32,
  priority = false,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src="/pay3-logo.png"
      alt="Pay3"
      width={size}
      height={size}
      priority={priority}
      className={`object-contain ${className}`}
    />
  );
}
