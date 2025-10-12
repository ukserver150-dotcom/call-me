"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import {
  ref,
  set,
  get,
  onValue,
  off,
  push,
  onChildAdded,
  remove,
} from "firebase/database";
import { firestore, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Mic, PhoneOff, Video, VideoOff, Send, LogIn, PlusCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "./ui/separator";

interface Message {
  id: string;
  text: string;
  createdAt: Timestamp;
}

const servers = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

export default function EchoVerseClient() {
  const [roomId, setRoomId] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [status, setStatus] = useState("Ready to start");

  const { toast } = useToast();

  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const hangUp = useCallback(async () => {
    if (pc.current) {
      pc.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      pc.current.close();
    }
    
    if (roomId && db) {
      const roomRef = ref(db, `rooms/${roomId}`);
      try {
        await remove(roomRef);
      } catch (error) {
        console.error("Error removing room from DB:", error);
      }
    }
  
    if (localAudioRef.current) localAudioRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    
    setMicActive(false);
    setInCall(false);
    setRoomId("");
    setStatus("Call ended");
    toast({ title: "Call Ended", description: "The connection has been closed." });
  }, [roomId, toast]);

  useEffect(() => {
    pc.current = new RTCPeerConnection(servers);

    return () => {
      if (inCall) {
        hangUp();
      }
    };
  }, [inCall, hangUp]);

  const startMic = async () => {
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });

      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream.current;
      }
      
      setMicActive(true);
      setStatus("Microphone is on");
      toast({ title: "Microphone Active", description: "You can now create or join a room." });
    } catch (error) {
      console.error("Error accessing media devices.", error);
      setStatus("Error: Could not access microphone.");
      toast({ variant: "destructive", title: "Microphone Error", description: "Could not access your microphone. Please check permissions." });
    }
  };

  const setupWebRTC = useCallback((currentRoomId: string) => {
    if (!pc.current || !localStream.current) {
        setStatus("Error: Mic not started or connection not ready.");
        toast({variant: "destructive", title: "WebRTC Error", description: "Microphone not started."});
        return;
    }
    
    localStream.current.getTracks().forEach((track) => {
      pc.current?.addTrack(track, localStream.current!);
    });

    pc.current.ontrack = (event) => {
      remoteStream.current = event.streams[0];
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream.current;
      }
    };

    pc.current.oniceconnectionstatechange = () => {
        if(pc.current?.iceConnectionState === 'connected') {
            setStatus(`Connected in room: ${currentRoomId}`);
            setInCall(true);
            toast({ title: "Connected!", description: "You are now connected." });
        }
    }
  }, [toast]);
  

  const createRoom = async () => {
    if (!micActive) {
      toast({ variant: "destructive", title: "Mic not active", description: "Please start your microphone first." });
      return;
    }

    const newRoomId = Math.random().toString(36).substring(2, 9);
    setRoomId(newRoomId);
    const roomRef = ref(db, `rooms/${newRoomId}`);
    
    setupWebRTC(newRoomId);

    const offerCandidates = ref(db, `rooms/${newRoomId}/offerCandidates`);
    const answerCandidates = ref(db, `rooms/${newRoomId}/answerCandidates`);
    
    pc.current!.onicecandidate = (event) => {
        event.candidate && push(offerCandidates, event.candidate.toJSON());
    };

    const offerDescription = await pc.current!.createOffer();
    await pc.current!.setLocalDescription(offerDescription);
    
    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
    };
    await set(ref(db, `rooms/${newRoomId}/offer`), offer);
    
    onValue(ref(db, `rooms/${newRoomId}/answer`), (snapshot) => {
        const answer = snapshot.val();
        if (answer && !pc.current!.currentRemoteDescription) {
            const answerDescription = new RTCSessionDescription(answer);
            pc.current!.setRemoteDescription(answerDescription);
        }
    });

    onChildAdded(answerCandidates, (snapshot) => {
        const candidate = new RTCIceCandidate(snapshot.val());
        pc.current!.addIceCandidate(candidate);
    });

    setStatus(`Room created: ${newRoomId}. Waiting for a peer...`);
    toast({ title: "Room Created", description: `Your Room ID is: ${newRoomId}` });

    // Chat setup
    const q = query(collection(firestore, 'chats', newRoomId, 'messages'), orderBy('createdAt'));
    onSnapshot(q, (querySnapshot) => {
      const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    });
  };

  const joinRoom = async () => {
    if (!micActive) {
      toast({ variant: "destructive", title: "Mic not active", description: "Please start your microphone first." });
      return;
    }
    if (!joinRoomId) {
      toast({ variant: "destructive", title: "No Room ID", description: "Please enter a Room ID to join." });
      return;
    }

    setRoomId(joinRoomId);
    setupWebRTC(joinRoomId);

    const roomRef = ref(db, `rooms/${joinRoomId}`);
    const roomSnapshot = await get(roomRef);

    if (!roomSnapshot.exists()) {
      setStatus("Error: Room does not exist.");
      toast({ variant: "destructive", title: "Invalid Room", description: "The Room ID you entered is not valid." });
      return;
    }

    const offerCandidates = ref(db, `rooms/${joinRoomId}/offerCandidates`);
    const answerCandidates = ref(db, `rooms/${joinRoomId}/answerCandidates`);
    
    pc.current!.onicecandidate = (event) => {
        event.candidate && push(answerCandidates, event.candidate.toJSON());
    };

    const offerDescription = roomSnapshot.val().offer;
    await pc.current!.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.current!.createAnswer();
    await pc.current!.setLocalDescription(answerDescription);
    
    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
    };
    await set(ref(db, `rooms/${joinRoomId}/answer`), answer);
    
    onChildAdded(offerCandidates, (snapshot) => {
        const candidate = new RTCIceCandidate(snapshot.val());
        pc.current!.addIceCandidate(candidate);
    });

    setStatus(`Joining room: ${joinRoomId}`);
    
    // Chat setup
    const q = query(collection(firestore, 'chats', joinRoomId, 'messages'), orderBy('createdAt'));
    onSnapshot(q, (querySnapshot) => {
        const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
        setMessages(msgs);
    });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !roomId) return;
    
    await addDoc(collection(firestore, 'chats', roomId, 'messages'), {
      text: newMessage,
      createdAt: serverTimestamp(),
    });
    setNewMessage("");
  };

  return (
    <Card className="w-full max-w-2xl bg-white/80 dark:bg-card/80 backdrop-blur-sm shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-headline font-bold text-center text-gray-800 dark:text-gray-200">EchoVerse</CardTitle>
        <CardDescription className="text-center">Real-time Audio & Chat</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
            <audio ref={localAudioRef} autoPlay playsInline muted className="hidden"></audio>
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden"></audio>

            {!micActive ? (
                <Button onClick={startMic} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Mic className="mr-2 h-4 w-4" /> Start Mic
                </Button>
            ) : (
                <div className="w-full flex justify-center items-center text-sm text-green-600 dark:text-green-400 font-medium p-2 bg-green-100 dark:bg-green-900/50 rounded-md">
                    <Mic className="mr-2 h-4 w-4" /> Microphone On
                </div>
            )}
        </div>
        
        <Separator />

        {!inCall ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
                <Button onClick={createRoom} disabled={!micActive}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Room
                </Button>
            </div>
            <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <Input 
                        placeholder="Enter Room ID" 
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value)}
                        disabled={!micActive}
                    />
                    <Button onClick={joinRoom} disabled={!micActive}>
                        <LogIn className="mr-2 h-4 w-4" /> Join
                    </Button>
                </div>
            </div>
          </div>
        ) : (
             <div className="flex justify-center">
                 <Button onClick={hangUp} variant="destructive" className="w-full sm:w-1/2">
                    <PhoneOff className="mr-2 h-4 w-4" /> Hang Up
                </Button>
             </div>
        )}

        <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="font-mono text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Status:</span> {status}
            </p>
            {roomId && !inCall &&
                <p className="font-mono text-sm text-muted-foreground mt-1">
                    <span className="font-semibold text-foreground">Room ID:</span> {roomId}
                </p>
            }
        </div>
        
        {inCall && (
          <>
            <Separator />
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-center">Chat</h3>
                <ScrollArea className="h-48 w-full rounded-md border p-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className="text-sm mb-2">
                           <p>{msg.text}</p>
                           <p className="text-xs text-muted-foreground">
                             {new Date(msg.createdAt?.toDate()).toLocaleTimeString()}
                           </p>
                        </div>
                    ))}
                </ScrollArea>
                <form onSubmit={sendMessage} className="flex gap-2">
                    <Input 
                        value={newMessage} 
                        onChange={(e) => setNewMessage(e.target.value)} 
                        placeholder="Type a message..."
                    />
                    <Button type="submit" className="bg-accent hover:bg-accent/90">
                        <Send className="h-4 w-4"/>
                    </Button>
                </form>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground text-center w-full">
            Setup: 1. Start Mic. 2. Create a room or join with an ID. 3. Start talking & chatting.
        </p>
      </CardFooter>
    </Card>
  );
}
