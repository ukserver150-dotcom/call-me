import { create } from 'zustand';
import { type User } from '@/lib/firebase/schema';
import { getDatabase, ref, set, onValue, off, remove, push, get, child } from 'firebase/database';
import { useToast } from './use-toast';
import { MutableRefObject } from 'react';

export interface Call {
    roomId: string;
    caller: User;
    callee: User;
    status: 'outgoing' | 'ringing' | 'connected' | 'declined' | 'ended';
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
}

export interface IncomingCall {
    roomId: string;
    caller: User;
    status: 'ringing';
}

interface CallState {
    call: Call | null;
    incomingCall: IncomingCall | null;
    peerConnection: RTCPeerConnection | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    localAudioRef: MutableRefObject<HTMLAudioElement | null>;
    remoteAudioRef: MutableRefObject<HTMLAudioElement | null>;
    ringtone: HTMLAudioElement | null;
    startCall: (callData: Omit<Call, 'status'> & { status: 'outgoing' }) => void;
    answerCall: (currentUser: User) => void;
    declineCall: () => void;
    endCall: () => void;
    setIncomingCall: (callData: IncomingCall | null) => void;
    initPeerConnection: () => RTCPeerConnection;
}

const servers = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

export const useCallStore = create<CallState>((set, get) => ({
    call: null,
    incomingCall: null,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    localAudioRef: { current: null },
    remoteAudioRef: { current: null },
    ringtone: null,

    setIncomingCall: (callData) => {
        if(get().call || get().incomingCall) return;
        set({ incomingCall: callData });
        if (callData) {
            const audio = new Audio('/audio/ringtone.mp3');
            audio.loop = true;
            audio.play();
            set({ ringtone: audio });
        }
    },
    
    initPeerConnection: () => {
        const pc = new RTCPeerConnection(servers);
        
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'failed') {
                get().endCall();
            }
        };

        set({ peerConnection: pc });
        return pc;
    },

    startCall: async (callData) => {
        const { toast } = useToast();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            set({ localStream: stream });
            if (get().localAudioRef.current) {
                get().localAudioRef.current!.srcObject = stream;
            }

            const pc = get().initPeerConnection();

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            pc.ontrack = (event) => {
                set({ remoteStream: event.streams[0] });
                 if (get().remoteAudioRef.current) {
                    get().remoteAudioRef.current!.srcObject = event.streams[0];
                }
            };
            
            set({ call: callData });
            const db = getDatabase();
            const callRef = ref(db, `calls/${callData.callee.uid}`);
            const roomRef = ref(db, `rooms/${callData.roomId}`);

            const offerCandidates = child(roomRef, 'offerCandidates');
            const answerCandidates = child(roomRef, 'answerCandidates');
            
            pc.onicecandidate = event => {
                event.candidate && push(offerCandidates, event.candidate.toJSON());
            };

            const offerDescription = await pc.createOffer();
            await pc.setLocalDescription(offerDescription);

            const offer = { sdp: offerDescription.sdp, type: offerDescription.type };

            const callPayload = {
                ...callData,
                status: 'ringing'
            };

            await set(callRef, callPayload);
            await set(child(roomRef, 'offer'), offer);

            onValue(child(roomRef, 'answer'), async (snapshot) => {
                if (snapshot.exists() && !pc.currentRemoteDescription) {
                    const answerDescription = new RTCSessionDescription(snapshot.val());
                    await pc.setRemoteDescription(answerDescription);
                    set({ call: { ...callData, status: 'connected' } });
                }
            });
            
            onValue(child(roomRef, 'status'), (snapshot) => {
                if (snapshot.val() === 'declined') {
                    toast({ title: 'Call Declined', description: `${callData.callee.fullname} declined your call.` });
                    get().endCall();
                }
                 if (snapshot.val() === 'ended') {
                    get().endCall();
                }
            });

            onValue(answerCandidates, (snapshot) => {
                snapshot.forEach((childSnapshot) => {
                    pc.addIceCandidate(new RTCIceCandidate(childSnapshot.val()));
                });
            });

        } catch (err) {
            toast({ variant: 'destructive', title: 'Microphone Error', description: 'Could not access microphone. Please check permissions.' });
            console.error(err);
        }
    },

    answerCall: async (currentUser) => {
        const { incomingCall, ringtone } = get();
        if (!incomingCall) return;

        ringtone?.pause();
        set({ ringtone: null });

        const { toast } = useToast();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            set({ localStream: stream });
            if (get().localAudioRef.current) {
                get().localAudioRef.current!.srcObject = stream;
            }

            const pc = get().initPeerConnection();
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            pc.ontrack = (event) => {
                set({ remoteStream: event.streams[0] });
                if (get().remoteAudioRef.current) {
                    get().remoteAudioRef.current!.srcObject = event.streams[0];
                }
            };
            
            const db = getDatabase();
            const roomRef = ref(db, `rooms/${incomingCall.roomId}`);
            const offerCandidates = child(roomRef, 'offerCandidates');
            const answerCandidates = child(roomRef, 'answerCandidates');
            
            pc.onicecandidate = event => {
                event.candidate && push(answerCandidates, event.candidate.toJSON());
            };
            
            const offerSnapshot = await get(child(roomRef, 'offer'));
            if(offerSnapshot.exists()) {
                await pc.setRemoteDescription(new RTCSessionDescription(offerSnapshot.val()));
            }

            const answerDescription = await pc.createAnswer();
            await pc.setLocalDescription(answerDescription);
            
            const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
            await set(child(roomRef, 'answer'), answer);

            set({
                call: { ...incomingCall, callee: currentUser, status: 'connected' },
                incomingCall: null,
            });
            
            const callerCallRef = ref(db, `calls/${incomingCall.caller.uid}`);
            await remove(callerCallRef);

            onValue(offerCandidates, (snapshot) => {
                snapshot.forEach((childSnapshot) => {
                    pc.addIceCandidate(new RTCIceCandidate(childSnapshot.val()));
                });
            });

             onValue(child(roomRef, 'status'), (snapshot) => {
                if (snapshot.val() === 'ended') {
                    get().endCall();
                }
            });


        } catch (err) {
            toast({ variant: 'destructive', title: 'Microphone Error', description: 'Could not access microphone. Please check permissions.' });
            console.error(err);
        }
    },
    
    declineCall: () => {
        const { incomingCall, call, ringtone } = get();
        const db = getDatabase();
        const callToDecline = incomingCall || call;
        
        ringtone?.pause();
        set({ ringtone: null });

        if (!callToDecline) return;

        const roomRef = ref(db, `rooms/${callToDecline.roomId}`);
        const callerCallRef = ref(db, `calls/${callToDecline.caller.uid}`);

        set(child(roomRef, 'status'), 'declined').then(() => {
            remove(callerCallRef);
            get().endCall(false); // End call without notifying room
        });
    },

    endCall: (notifyRoom = true) => {
        get().peerConnection?.close();
        get().localStream?.getTracks().forEach(track => track.stop());
        get().ringtone?.pause();
        
        const { call } = get();
        if (call && notifyRoom) {
            const db = getDatabase();
            const roomRef = ref(db, `rooms/${call.roomId}`);
            set(child(roomRef, 'status'), 'ended');
            // Clean up database entries
            setTimeout(() => {
                remove(ref(db, `calls/${call.caller.uid}`));
                remove(ref(db, `calls/${call.callee.uid}`));
                remove(roomRef);
            }, 5000); // Delay to allow all parties to see the 'ended' status
        }

        set({
            call: null,
            incomingCall: null,
            peerConnection: null,
            localStream: null,
            remoteStream: null,
            ringtone: null,
        });
        if(get().localAudioRef.current) get().localAudioRef.current!.srcObject = null;
        if(get().remoteAudioRef.current) get().remoteAudioRef.current!.srcObject = null;
    },
}));