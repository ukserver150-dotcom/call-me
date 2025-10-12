

"use client";

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Speaker, Volume2, Waves } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { useCallStore, type Call } from '@/hooks/use-call-store';
import { useToast } from '@/hooks/use-toast';

const InCallView = ({ call }: { call: Call }) => {
    const { endCall } = useCallStore();
    const { toast } = useToast();
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaker, setIsSpeaker] = useState(false);
    const [callDuration, setCallDuration] = useState(0);

    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const localAudioRef = useRef<HTMLAudioElement | null>(null);

    const callStore = useCallStore();

    useEffect(() => {
        if (callStore.localStream && localAudioRef.current) {
            localAudioRef.current.srcObject = callStore.localStream;
        }
        if (callStore.remoteStream && remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = callStore.remoteStream;
        }
    }, [callStore.localStream, callStore.remoteStream]);


    useEffect(() => {
        const timer = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };
    
    const toggleMute = () => {
        const stream = localAudioRef.current?.srcObject as MediaStream;
        if (stream) {
            stream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleSpeaker = () => {
        if (remoteAudioRef.current) {
            // This is a simplified approach. Real speakerphone control is complex
            // and might require native device APIs, which are not accessible from web.
            // We can simulate by changing volume.
            remoteAudioRef.current.volume = isSpeaker ? 0.5 : 1.0;
             toast({
                title: isSpeaker ? "Speaker Off" : "Speaker On",
                description: "This is a simulated feature."
            });
        }
        setIsSpeaker(!isSpeaker);
    };

    const otherUser = call.caller.uid === callStore.call?.caller.uid ? call.callee : call.caller;

    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="bg-card p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center w-full max-w-sm">
                <Avatar className="w-28 h-28 mb-4 border-4 border-primary">
                    <AvatarImage src={otherUser.avatarUrl || ''} />
                    <AvatarFallback>{otherUser.fullname.charAt(0)}</AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-bold">{otherUser.fullname}</h2>
                <p className="text-muted-foreground">{formatDuration(callDuration)}</p>

                <div className="flex justify-center items-center my-8 h-10">
                    <Waves className="w-16 h-16 text-primary animate-pulse" />
                </div>
                
                <div className="flex justify-around w-full mt-8">
                    <Button variant="ghost" size="icon" className="w-16 h-16 rounded-full bg-card-foreground/10" onClick={toggleMute}>
                        {isMuted ? <MicOff /> : <Mic />}
                    </Button>
                    <Button variant="destructive" size="icon" className="w-16 h-16 rounded-full" onClick={() => endCall()}>
                        <PhoneOff />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-16 h-16 rounded-full bg-card-foreground/10" onClick={toggleSpeaker}>
                        {isSpeaker ? <Volume2 /> : <Speaker />}
                    </Button>
                </div>
            </div>
             {/* Hidden audio elements */}
            <audio ref={localAudioRef} autoPlay muted playsInline className="hidden"></audio>
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden"></audio>
        </motion.div>
    );
};

export default InCallView;
