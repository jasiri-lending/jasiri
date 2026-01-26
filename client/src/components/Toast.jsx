import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// Toast Item Component
const ToastItem = ({ id, message, type, onClose, duration = 3000 }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));

        const timer = setTimeout(() => {
            handleClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration]);

    const handleClose = () => {
        setIsVisible(false); // Trigger exit animation
        setTimeout(() => {
            onClose(id);
        }, 300); // Wait for animation
    };

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle className="h-5 w-5 text-emerald-600" />;
            case 'error': return <AlertCircle className="h-5 w-5 text-red-600" />;
            case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-600" />;
            default: return <Info className="h-5 w-5 text-blue-600" />;
        }
    };

    const getStyles = () => {
        switch (type) {
            case 'success': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
            case 'error': return 'bg-red-50 border-red-200 text-red-800';
            case 'warning': return 'bg-amber-50 border-amber-200 text-amber-800';
            default: return 'bg-blue-50 border-blue-200 text-blue-800';
        }
    };

    const getTitle = () => {
        switch (type) {
            case 'success': return 'Success';
            case 'error': return 'Error';
            case 'warning': return 'Warning';
            default: return 'Info';
        }
    };

    return (
        <div
            className={`
                flex items-center gap-3 p-4 rounded-lg shadow-lg border min-w-[320px] max-w-md
                transform transition-all duration-300 ease-in-out cursor-pointer
                ${getStyles()}
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            `}
            onClick={handleClose}
            role="alert"
        >
            <div className="flex-shrink-0">
                {getIcon()}
            </div>
            <div className="flex-1">
                <p className="text-sm font-semibold">
                    {getTitle()}
                </p>
                <p className="text-sm mt-0.5 leading-tight">
                    {message}
                </p>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                }}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-white/50"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now().toString();
        const newToast = { id, message, type, duration };
        setToasts(prev => [...prev, newToast]);
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // Helper functions for convenience
    const success = (msg, duration) => showToast(msg, 'success', duration);
    const error = (msg, duration) => showToast(msg, 'error', duration);
    const warning = (msg, duration) => showToast(msg, 'warning', duration);
    const info = (msg, duration) => showToast(msg, 'info', duration);

    const value = {
        showToast,
        success,
        error,
        warning,
        info,
        removeToast
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem
                            {...toast}
                            onClose={removeToast}
                        />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};