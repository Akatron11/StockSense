import { getInitials } from "../auth/initials";

interface AvatarProps {
  name: string | null | undefined;
  onClick?: () => void;
}

export function Avatar({ name, onClick }: AvatarProps) {
  return (
    <div className="avatar" onClick={onClick}>
      {getInitials(name)}
    </div>
  );
}
