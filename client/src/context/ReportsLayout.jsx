import { useReportAuth } from "../hooks/useReportAuth";
import LoginModal from "../pages/registry/LoginModal";

const ReportsLayout = ({ children }) => {
  const { isReportAuthenticated, checking } = useReportAuth();

  if (checking) return null;

  if (!isReportAuthenticated) {
    return (
      <LoginModal
        isOpen={true}
        onClose={() => {
          localStorage.removeItem("reportUser");
        }}
        onSuccess={() => {
          // nothing needed here; event handles it
        }}
      />
    );
  }

  return children;
};

export default ReportsLayout;
