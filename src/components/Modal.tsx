import React from "react";

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ onClose, children }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-0">
        {children}
      </div>
    </div>
  );
};

export default Modal;
