import { forwardRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

export const HCAPTCHA_SITEKEY = "f1fe106a-5c0c-4d5e-89c0-9c863b96cdee";

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
