import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = "", ...props }) => {
  return (
    <div 
      className={`bg-secondary-light border border-secondary-lighter rounded-lg p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

