
"use client";

import { motion } from 'framer-motion';
import { PhoneOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { useCallStore, type Call } from '@/hooks/use-call-store';

const OutgoingCall = ({ call }: { call: Call }) => {
    const { endCall } = useCallStore();

    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="bg-card p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center w-full max-w-sm">
                <div className="relative">
                    <Avatar className="w-32 h-32 mb-4">
                        <AvatarImage src={call.callee.avatarUrl || ''} />
                        <AvatarFallback className="text-4xl">{call.callee.fullname.charAt(0)}</AvatarFallback>
                    </Avatar>
                     <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-pulse"></div>
                     <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                </div>
                <h2 className="text-2xl font-bold mt-4">{call.callee.fullname}</h2>
                <p className="text-muted-foreground">Calling...</p>
                <Button variant="destructive" size="lg" className="rounded-full w-16 h-16 mt-16" onClick={endCall}>
                    <PhoneOff />
                </Button>
            </div>
        </motion.div>
    );
};

export default OutgoingCall;
