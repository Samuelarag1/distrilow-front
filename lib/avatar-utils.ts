type AvatarUserLike = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
};

function clean(value: string | null | undefined) {
  if (!value) return "";
  return value.trim();
}

function encodeSeed(value: string) {
  return encodeURIComponent(value);
}

export function buildDefaultAvatarUrl(seed: string) {
  const fallbackSeed = clean(seed) || "usuario";
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeSeed(
    fallbackSeed
  )}&backgroundType=gradientLinear`;
}

export function resolveUserAvatar(user?: AvatarUserLike | null) {
  const explicit = clean(user?.avatar ?? undefined);
  if (explicit) return explicit;

  const seed =
    clean(user?.name ?? undefined) ||
    clean(user?.email ?? undefined) ||
    clean(user?.id ?? undefined) ||
    "usuario";

  return buildDefaultAvatarUrl(seed);
}

export function getPresetAvatarOptions(user?: AvatarUserLike | null) {
  const baseSeed =
    clean(user?.name ?? undefined) ||
    clean(user?.email ?? undefined) ||
    clean(user?.id ?? undefined) ||
    "usuario";

  const styles = [
    "initials",
    "bottts-neutral",
    "personas",
    "adventurer-neutral",
    "identicon",
    "micah",
  ];

  return styles.map((style, index) => {
    const seed = `${baseSeed}-${index + 1}`;
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeSeed(seed)}`;
  });
}
