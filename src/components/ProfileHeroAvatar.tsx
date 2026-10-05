import { useEffect, useState, type ReactNode } from 'react';

interface ProfileHeroAvatarProps {
  avatarUrl?: string | null;
  fullName: string;
  fallback: ReactNode;
}

export default function ProfileHeroAvatar({
  avatarUrl,
  fullName,
  fallback,
}: ProfileHeroAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <div className="flex aspect-[3/4] w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 ring-1 ring-white/20 sm:w-40">
      {avatarUrl && !imageFailed ? (
        <img
          className="h-full w-full object-fill"
          src={avatarUrl}
          alt={`Foto de ${fullName}`}
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
