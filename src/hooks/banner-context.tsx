// BannerContext.tsx
import React, { createContext, useContext, useState } from 'react';

type BannerContextType = {
    visible: boolean;
    message: string;
    showBanner: (msg: string) => void;
    hideBanner: () => void;
};

const BannerContext = createContext<BannerContextType | undefined>(undefined);

export const BannerProvider = ({ children }: { children: React.ReactNode }) => {
    const [visible, setVisible] = useState(false);
    const [message, setMessage] = useState('');

    const showBanner = (msg: string) => {
        setMessage(msg);
        setVisible(true);
    };

    const hideBanner = () => setVisible(false);

    return (
        <BannerContext.Provider value={{ visible, message, showBanner, hideBanner }}>
            {children}
        </BannerContext.Provider>
    );
};

export const useBanner = () => {
    const context = useContext(BannerContext);
    if (!context) throw new Error('useBanner must be used within BannerProvider');
    return context;
};