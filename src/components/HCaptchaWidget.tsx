import { forwardRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

export const HCAPTCHA_SITEKEY = "c9627c00-7bc0-4b8a-8a50-06863aa8d976";

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
