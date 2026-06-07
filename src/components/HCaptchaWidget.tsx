import { forwardRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

// Dev (vite serve) uses hCaptcha's official test sitekey — always passes and works on
// localhost, which the production sitekey's Domains list cannot allow. Production builds
// (import.meta.env.DEV === false) use the real key. Server-side captcha is disabled
// (security_captcha_enabled=false), so the token is only consumed client-side regardless.
export const HCAPTCHA_SITEKEY = import.meta.env.DEV
  ? "10000000-ffff-ffff-ffff-000000000001"
  : "038c4d7c-e0ea-45d6-836e-58d0bc9eb88c";

interface Props {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

const HCaptchaWidget = forwardRef<HCaptcha, Props>(({ onVerify, onExpire }, ref) => {
  return (
    <div className="flex justify-center">
      <HCaptcha
        ref={ref}
        sitekey={HCAPTCHA_SITEKEY}
        theme="dark"
        onVerify={onVerify}
        onExpire={onExpire}
      />
    </div>
  );
});

HCaptchaWidget.displayName = "HCaptchaWidget";
export default HCaptchaWidget;
