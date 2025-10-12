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
  doc,
  getDocs,
  where,
  setDoc,
  deleteDoc,
  writeBatch,
  getDoc,
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
  onDisconnect,
} from "firebase/database";
import { useFirestore } from "@/firebase/firestore/use-firestore";
import { useDatabase } from "@/firebase/database/use-database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Mic, PhoneOff, Video, VideoOff, Send, LogIn, PlusCircle, UserPlus, Users, Search, Bell } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Badge } from "./ui/badge";
import {
  type User,
  type FriendRequest,
  type Friend,
} from "@/lib/firebase/schema";
import { type User as FirebaseUser } from "firebase/auth";


interface Message {
  id: string;
  from: string;
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

export default function EchoVerseClient({ user, profile }: { user: FirebaseUser, profile: User }) {
  const [activeChat, setActiveChat] = useState<Friend | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [status, setStatus] = useState("Ready to start");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { toast } = useToast();
  const firestore = useFirestore();
  const db = useDatabase();

  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const roomId = activeChat ? [user.uid, activeChat.uid].sort().join('_') : null;

  useEffect(() => {
    if (!user || !db) return;
    const presenceRef = ref(db, `/presence/${user.uid}`);
    set(presenceRef, { online: true });
    onDisconnect(presenceRef).set({ online: false, lastSeen: serverTimestamp() });
  }, [user, db]);

  useEffect(() => {
    if (!user || !firestore) return;

    const friendsQuery = query(collection(firestore, 'users', user.uid, 'friends'));
    const friendsUnsubscribe = onSnapshot(friendsQuery, (snapshot) => {
      const friendsList = snapshot.docs.map(doc => doc.data() as Friend);
      setFriends(friendsList);
    });

    const requestsQuery = query(collection(firestore, 'users', user.uid, 'requests'));
    const requestsUnsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const requestsList = snapshot.docs.map(doc => doc.data() as FriendRequest);
      setFriendRequests(requestsList);
    });

    const sentRequestsQuery = query(collection(firestore, 'users', user.uid, 'sentRequests'));
    const sentRequestsUnsubscribe = onSnapshot(sentRequestsQuery, (snapshot) => {
      const sentToList = snapshot.docs.map(doc => doc.id);
      setSentRequests(sentToList);
    });

    return () => {
      friendsUnsubscribe();
      requestsUnsubscribe();
      sentRequestsUnsubscribe();
    }
  }, [user, firestore]);

  const handleSearch = async () => {
    if (!firestore || !searchQuery) return;
    const usersRef = collection(firestore, "users");
    const q = query(usersRef, where("username", "==", searchQuery));
    const querySnapshot = await getDocs(q);
    const users = querySnapshot.docs.map(doc => doc.data() as User).filter(u => u.uid !== user.uid);
    setSearchResults(users);
  };

  const sendFriendRequest = async (toUser: User) => {
    if (!firestore || !user || !profile) return;

    // Validate: no self-request
    if (toUser.uid === user.uid) {
        toast({ variant: "destructive", title: "Cannot add yourself" });
        return;
    }
    // Validate: no existing friend
    if (friends.some(friend => friend.uid === toUser.uid)) {
        toast({ variant: "destructive", title: "Already friends" });
        return;
    }
    // Validate: no duplicate request
    if (sentRequests.includes(toUser.uid)) {
        toast({ variant: "destructive", title: "Request already sent" });
        return;
    }
    
    const batch = writeBatch(firestore);

    const requestRef = doc(firestore, 'users', toUser.uid, 'requests', user.uid);
    batch.set(requestRef, { from: user.uid, username: profile.username, fullname: profile.fullname, ts: serverTimestamp() });

    const sentRequestRef = doc(firestore, 'users', user.uid, 'sentRequests', toUser.uid);
    batch.set(sentRequestRef, { to: toUser.uid });
    
    await batch.commit();
    toast({ title: "Friend Request Sent" });
  };

  const handleFriendRequest = async (request: FriendRequest, accept: boolean) => {
    if (!firestore || !user || !profile) return;

    const batch = writeBatch(firestore);
    
    const requestRef = doc(firestore, 'users', user.uid, 'requests', request.from);
    batch.delete(requestRef);
    
    const sentRequestRef = doc(firestore, 'users', request.from, 'sentRequests', user.uid);
    batch.delete(sentRequestRef);

    if (accept) {
      const userFriendRef = doc(firestore, 'users', user.uid, 'friends', request.from);
      batch.set(userFriendRef, { uid: request.from, username: request.username, fullname: request.fullname, since: serverTimestamp() });
      
      const newFriendRef = doc(firestore, 'users', request.from, 'friends', user.uid);
      batch.set(newFriendRef, { uid: user.uid, username: profile.username, fullname: profile.fullname, since: serverTimestamp() });
    }
    
    await batch.commit();
    toast({ title: accept ? "Friend Added" : "Request Declined" });
  };


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
      const callRef = ref(db, `calls/${roomId}`);
      try {
        await remove(callRef);
      } catch (error) {
        console.error("Error removing call room from DB:", error);
      }
    }
  
    if (localAudioRef.current) localAudioRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    
    setMicActive(false);
    setInCall(false);
    setStatus("Call ended");
    toast({ title: "Call Ended", description: "The connection has been closed." });
  }, [roomId, db, toast]);

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
      toast({ title: "Microphone Active" });
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
            setStatus(`Connected in call with ${activeChat?.username}`);
            setInCall(true);
            toast({ title: "Connected!", description: "You are now connected." });
        }
    }
  }, [toast, activeChat]);
  

  const createCall = async () => {
    if (!micActive) {
      toast({ variant: "destructive", title: "Mic not active", description: "Please start your microphone first." });
      return;
    }
    if (!roomId || !db) return;

    setupWebRTC(roomId);
    
    const callRef = ref(db, `calls/${roomId}`);
    const offerCandidates = ref(db, `calls/${roomId}/callerCandidates`);
    const answerCandidates = ref(db, `calls/${roomId}/calleeCandidates`);
    
    pc.current!.onicecandidate = (event) => {
        event.candidate && push(offerCandidates, event.candidate.toJSON());
    };

    const offerDescription = await pc.current!.createOffer();
    await pc.current!.setLocalDescription(offerDescription);
    
    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
    };
    await set(ref(db, `calls/${roomId}/offer`), offer);
    
    onValue(ref(db, `calls/${roomId}/answer`), (snapshot) => {
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

    setStatus(`Calling ${activeChat?.username}...`);
    toast({ title: "Calling", description: `Waiting for ${activeChat?.username} to answer.` });
  };

  const joinCall = async (callRoomId: string) => {
    if (!micActive) {
      toast({ variant: "destructive", title: "Mic not active", description: "Please start your microphone first." });
      return;
    }
    if (!db) return;

    setupWebRTC(callRoomId);

    const callRef = ref(db, `calls/${callRoomId}`);
    const callSnapshot = await get(callRef);

    if (!callSnapshot.exists()) {
      setStatus("Error: Call does not exist.");
      toast({ variant: "destructive", title: "Invalid Call", description: "Could not find call to join." });
      return;
    }

    const offerCandidates = ref(db, `calls/${callRoomId}/callerCandidates`);
    const answerCandidates = ref(db, `calls/${callRoomId}/calleeCandidates`);
    
    pc.current!.onicecandidate = (event) => {
        event.candidate && push(answerCandidates, event.candidate.toJSON());
    };

    const offerDescription = callSnapshot.val().offer;
    await pc.current!.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.current!.createAnswer();
    await pc.current!.setLocalDescription(answerDescription);
    
    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
    };
    await set(ref(db, `calls/${callRoomId}/answer`), answer);
    
    onChildAdded(offerCandidates, (snapshot) => {
        const candidate = new RTCIceCandidate(snapshot.val());
        pc.current!.addIceCandidate(candidate);
    });

    setStatus(`Joining call with ${activeChat?.username}`);
  };

  useEffect(() => {
    if (!roomId || !firestore) {
      setMessages([]);
      return;
    }
    const q = query(collection(firestore, 'rooms', roomId, 'messages'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [roomId, firestore]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !roomId || !firestore) return;
    
    await addDoc(collection(firestore, 'rooms', roomId, 'messages'), {
      from: user.uid,
      text: newMessage,
      createdAt: serverTimestamp(),
    });
    setNewMessage("");
  };
  
  // TODO: Add incoming call listener and UI

  return (
    <div className="flex h-screen w-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-1/4 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Avatar>
                    <AvatarImage src={profile.avatarUrl || undefined} />
                    <AvatarFallback>{profile.fullname.charAt(0)}</AvatarFallback>
                </Avatar>
                <h2 className="font-semibold">{profile.username}</h2>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <UserPlus />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Friends</DialogTitle>
                </DialogHeader>
                <div className="flex gap-2">
                  <Input placeholder="Search by username" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  <Button onClick={handleSearch}><Search/></Button>
                </div>
                <div className="space-y-2">
                  {searchResults.map(u => (
                    <div key={u.uid} className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{u.fullname}</p>
                        <p className="text-sm text-muted-foreground">@{u.username}</p>
                      </div>
                      <Button size="sm" onClick={() => sendFriendRequest(u)}>Send Request</Button>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                        <Bell />
                        {friendRequests.length > 0 && <Badge className="absolute top-0 right-0 h-4 w-4 p-0 justify-center">{friendRequests.length}</Badge>}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Friend Requests</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        {friendRequests.map(req => (
                            <div key={req.from} className="flex justify-between items-center">
                                <p>{req.username}</p>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleFriendRequest(req, false)}>Decline</Button>
                                    <Button size="sm" onClick={() => handleFriendRequest(req, true)}>Accept</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
        <ScrollArea className="flex-1">
          {friends.map(friend => (
            <div key={friend.uid} onClick={() => setActiveChat(friend)} className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${activeChat?.uid === friend.uid ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
              <Avatar>
                <AvatarImage src={undefined} />
                <AvatarFallback>{friend.username.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{friend.username}</p>
                {/* Add presence indicator here */}
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>
      
      {/* Chat Area */}
      <div className="w-3/4 flex flex-col">
        {activeChat ? (
          <>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={undefined} />
                  <AvatarFallback>{activeChat.username.charAt(0)}</AvatarFallback>
                </Avatar>
                <h2 className="font-semibold">{activeChat.username}</h2>
              </div>
              <div>
                <Button variant="ghost" size="icon" onClick={startMic} disabled={micActive}>
                  <Mic />
                </Button>
                <Button variant="ghost" size="icon" onClick={createCall} disabled={!micActive || inCall}>
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-phone-call"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M14.05 2a9 9 0 0 1 8 7.94"/><path d="M14.05 6A5 5 0 0 1 18 10"/></svg>
                </Button>
                <Button variant="ghost" size="icon" onClick={hangUp} disabled={!inCall}>
                  <PhoneOff />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.from === user.uid ? 'justify-end' : 'justify-start'} mb-2`}>
                  <div className={`rounded-lg p-2 max-w-xs ${msg.from === user.uid ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p>{msg.text}</p>
                    <p className="text-xs text-right mt-1">{new Date(msg.createdAt?.toDate()).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </ScrollArea>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <form onSubmit={sendMessage} className="flex gap-2">
                  <Input 
                      value={newMessage} 
                      onChange={(e) => setNewMessage(e.target.value)} 
                      placeholder="Type a message..."
                  />
                  <Button type="submit">
                      <Send className="h-4 w-4"/>
                  </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Select a friend to start chatting</p>
          </div>
        )}
      </div>

       <audio ref={localAudioRef} autoPlay playsInline muted className="hidden"></audio>
       <audio ref={remoteAudioRef} autoPlay playsInline className="hidden"></audio>
    </div>
  );
}
