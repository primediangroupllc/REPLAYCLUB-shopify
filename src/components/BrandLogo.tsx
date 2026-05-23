import { usePublicSiteSettings } from "@/hooks/useSiteSettings";
import bundledLogo from "@/assets/logo.png";

/**
 * Site-wide brand logo. Reads light/dark variants from site_settings with a
 * bundled fallback so the site never renders a missing image.
 * Default: dark variant on dark backgrounds (the app theme).
 */
interface BrandLogoProps {
  variant?: "light" | "dark";
  className?: string;
  alt?: string;
}

const BrandLogo = ({ variant = "dark", className, alt = "Replay Club" }: BrandLogoProps) => {
  const { settings } = usePublicSiteSettings();
  const src =
    (variant === "light" ? settings.logo_light_url : settings.logo_dark_url) ||
    settings.logo_dark_url ||
    settings.logo_light_url ||
    bundledLogo;
  return <img src={src} alt={alt} className={className} />;
};

export default BrandLogo;