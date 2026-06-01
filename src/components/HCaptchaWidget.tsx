import { forwardRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

export const HCAPTCHA_SITEKEY = "038c4d7c-e0ea-45d6-836e-58d0bc9eb88c";

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
