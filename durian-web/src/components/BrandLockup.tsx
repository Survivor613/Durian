type BrandLockupProps = {
  variant?: "hero" | "header";
  className?: string;
};

export function BrandLockup({ variant = "header", className = "" }: BrandLockupProps) {
  return <div className={`brand-lockup brand-lockup-${variant} ${className}`.trim()}>
    <span className="brand-lockup-mark">
      <img src="/assets/branding/gorilla-manager-seal-v1.png" alt="Durian 游戏图标" draggable={false} />
    </span>
    <span className="brand-lockup-copy">
      <strong>DURIAN</strong>
      <span>FRUIT SHOP PARTY GAME</span>
    </span>
  </div>;
}
