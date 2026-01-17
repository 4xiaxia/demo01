import { Navigate, useLocation } from 'react-router-dom';

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

    if (!isAuthenticated) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to when they were redirected.
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};
