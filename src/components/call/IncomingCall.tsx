
"use client";

import { motion } from 'framer-motion';
import { Phone, PhoneOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { useCallStore, type Call } from '@/hooks/use-call-store';
import { type User } from '@/lib/firebase/schema';

const IncomingCall = ({ call, currentUser }: { call: Call, currentUser: User }) => {
    const { answerCall, declineCall } = useCallStore();

    const handleAccept = () => {
        answerCall(currentUser);
    };

    const handleDecline = () => {
        declineCall();
    };
    
    return (
        <motion.div
            className="fixed bottom-5 right-5 z-50 bg-card rounded-lg shadow-2xl p-6 w-full max-w-sm"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            <div className="flex items-center space-x-4">
                <Avatar className="w-16 h-16">
                    <AvatarImage src={call.caller.avatarUrl || ''} />
                    <AvatarFallback>{call.caller.fullname.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="text-lg font-bold">{call.caller.fullname}</h3>
                    <p className="text-muted-foreground">Incoming call...</p>
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
                <Button variant="destructive" size="icon" className="w-12 h-12 rounded-full" onClick={handleDecline}>
                    <PhoneOff />
                </Button>
                <Button variant="default" size="icon" className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600" onClick={handleAccept}>
                    <Phone />
                </Button>
            </div>
        </motion.div>
    );
};

export default IncomingCall;
