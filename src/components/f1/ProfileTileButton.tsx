import { useEffect, useState } from "react";
import { DRIVER_PROFILE_PLACEHOLDER, TEAM_LOGO_PLACEHOLDER } from "@/lib/profile-images";

export function ProfileTileButton({
  name,
  profileType,
  imageSrc,
  backgroundColor,
  ariaLabel,
  selected,
  disabled,
  onClick,
}: {
  name: string;
  profileType: "driver" | "team";
  imageSrc: string;
  backgroundColor: string;
  ariaLabel: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const fallbackImage =
    profileType === "driver" ? DRIVER_PROFILE_PLACEHOLDER : TEAM_LOGO_PLACEHOLDER;
  const [visibleImage, setVisibleImage] = useState(imageSrc);

  useEffect(() => setVisibleImage(imageSrc), [imageSrc]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={ariaLabel}
      className={`relative aspect-square min-w-0 overflow-hidden rounded-lg border border-white/20 text-left text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "ring-2 ring-primary" : ""}`}
      style={{ backgroundColor }}
    >
      <span
        className={`absolute inset-0 flex items-center justify-center ${profileType === "team" ? "pb-4" : ""}`}
      >
        <img
          src={visibleImage}
          alt=""
          draggable={false}
          onError={() => setVisibleImage(fallbackImage)}
          className={
            profileType === "driver"
              ? "h-full w-full object-contain"
              : "h-[62%] w-[62%] rounded-full bg-black/20 object-contain p-2"
          }
        />
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/35 to-transparent"
      />
      <span className="absolute inset-x-[6%] bottom-[6%] truncate text-left font-mono text-[9px] font-black uppercase italic tracking-[0.08em] drop-shadow-[0_1px_3px_rgba(0,0,0,1)] sm:text-[10px]">
        {name.toUpperCase()}
      </span>
    </button>
  );
}
