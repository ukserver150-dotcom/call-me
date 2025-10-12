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
  Query,
  or,
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
import { Mic, PhoneOff, Send, UserPlus, UserRoundPlus, Search, BellRing, Cog, PanelLeft, MessageSquare, Phone } from "lucide-react";
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
import Settings from "./Settings";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarInset, SidebarFooter } from "./ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { LoadingSpinner } from "./LoadingSpinner";


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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

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
  
  useEffect(() => {
    const handleSearch = async () => {
      if (!firestore || !searchQuery) {
        setSearchResults([]);
        return;
      };
      setIsSearching(true);
      const usersRef = collection(firestore, "users");
      const q = query(
        usersRef,
        or(
          where("username", ">=", searchQuery),
          where("username", "<=", searchQuery + "\uf8ff"),
          where("fullname", ">=", searchQuery),
          where("fullname", "<=", searchQuery + "\uf8ff")
        )
      );
      try {
        const querySnapshot = await getDocs(q);
        const users = querySnapshot.docs
          .map(doc => doc.data() as User)
          .filter(u => u.uid !== user.uid);
        setSearchResults(users);
      } catch (error) {
        console.error("Error searching for users:", error);
        toast({ variant: "destructive", title: "Search Error", description: "Could not perform search." });
      } finally {
        setIsSearching(false);
      }
    };
    
    const debounceTimeout = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery, firestore, user.uid, toast]);


  const sendFriendRequest = async (toUser: User) => {
    if (!firestore || !user || !profile) return;

    if (toUser.uid === user.uid) {
        toast({ variant: "destructive", title: "Cannot add yourself" });
        return;
    }
    if (friends.some(friend => friend.uid === toUser.uid)) {
        toast({ variant: "destructive", title: "Already friends" });
        return;
    }
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
      pc.current = null;
    }
    if (roomId && db) {
      const callRef = ref(db, `calls/${roomId}`);
      try {
        await remove(callRef);
      } catch (error) {
        console.error("Error removing call room from DB:", error);
      }
    }
    if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
    }
    if (localAudioRef.current) localAudioRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setMicActive(false);
    setInCall(false);
    setStatus("Call ended");
    toast({ title: "Call Ended", description: "The connection has been closed." });
  }, [roomId, db, toast]);

  useEffect(() => {
    return () => {
      if (inCall) {
        hangUp();
      }
    };
  }, [inCall, hangUp]);

  const startMic = async () => {
    if (localStream.current) return;
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
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
    if (!localStream.current) {
        setStatus("Error: Mic not started.");
        toast({variant: "destructive", title: "WebRTC Error", description: "Microphone not started."});
        return;
    }
    pc.current = new RTCPeerConnection(servers);
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
    if (!micActive || !localStream.current) {
      toast({ variant: "destructive", title: "Mic not active", description: "Please start your microphone first." });
      return;
    }
    if (!roomId || !db) return;
    setupWebRTC(roomId);
    if (!pc.current) return;
    const callRef = ref(db, `calls/${roomId}`);
    const offerCandidates = ref(db, `calls/${roomId}/callerCandidates`);
    const answerCandidates = ref(db, `calls/${roomId}/calleeCandidates`);
    pc.current.onicecandidate = (event) => {
        event.candidate && push(offerCandidates, event.candidate.toJSON());
    };
    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);
    const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
    await set(ref(db, `calls/${roomId}/offer`), offer);
    onValue(ref(db, `calls/${roomId}/answer`), (snapshot) => {
        const answer = snapshot.val();
        if (answer && !pc.current!.currentRemoteDescription) {
            pc.current!.setRemoteDescription(new RTCSessionDescription(answer));
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
    if (!micActive || !localStream.current) {
      toast({ variant: "destructive", title: "Mic not active", description: "Please start your microphone first." });
      return;
    }
    if (!db) return;
    setupWebRTC(callRoomId);
    if (!pc.current) return;
    const callRef = ref(db, `calls/${callRoomId}`);
    const callSnapshot = await get(callRef);
    if (!callSnapshot.exists()) {
      setStatus("Error: Call does not exist.");
      toast({ variant: "destructive", title: "Invalid Call", description: "Could not find call to join." });
      return;
    }
    const offerCandidates = ref(db, `calls/${callRoomId}/callerCandidates`);
    const answerCandidates = ref(db, `calls/${callRoomId}/calleeCandidates`);
    pc.current.onicecandidate = (event) => {
        event.candidate && push(answerCandidates, event.candidate.toJSON());
    };
    const offerDescription = callSnapshot.val().offer;
    await pc.current.setRemoteDescription(new RTCSessionDescription(offerDescription));
    const answerDescription = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answerDescription);
    const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
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
  
  return (
    <>
      <Sidebar side="left" collapsible="icon" variant="sidebar">
        <SidebarHeader>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={profile.avatarUrl || undefined} />
                        <AvatarFallback>{profile.fullname.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                        <p className="font-semibold text-base text-sidebar-primary-foreground">{profile.fullname}</p>
                        <p className="text-sm text-sidebar-primary-foreground/80">@{profile.username}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="md:hidden"><PanelLeft /></Button>
            </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start">
                    <UserPlus className="mr-2"/> Add Friends
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Friends</DialogTitle>
                  </DialogHeader>
                  <div className="flex gap-2">
                    <Input placeholder="Search by username or name" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    <Button><Search/></Button>
                  </div>
                   <ScrollArea className="h-64">
                    <div className="space-y-4 py-4">
                      {isSearching ? (
                        <div className="flex justify-center items-center h-full">
                          <LoadingSpinner />
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map(u => (
                          <div key={u.uid} className="flex justify-between items-center">
                             <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={u.avatarUrl || undefined} />
                                  <AvatarFallback>{u.fullname.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-base">{u.fullname}</p>
                                  <p className="text-sm text-muted-foreground">@{u.username}</p>
                                </div>
                              </div>
                            <Button size="sm" onClick={() => sendFriendRequest(u)} disabled={sentRequests.includes(u.uid) || friends.some(f => f.uid === u.uid)}>
                              {sentRequests.includes(u.uid) ? 'Sent' : 'Add'}
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center">No users found.</p>
                      )}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
              <Dialog>
                  <DialogTrigger asChild>
                      <Button variant="ghost" className="w-full justify-start relative">
                        <BellRing className="mr-2"/> Friend Requests
                        {friendRequests.length > 0 && <Badge className="absolute top-1 right-2 h-5 w-5 p-0 justify-center">{friendRequests.length}</Badge>}
                      </Button>
                  </DialogTrigger>
                  <DialogContent>
                      <DialogHeader>
                          <DialogTitle>Friend Requests</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="h-64">
                        <div className="space-y-4 py-4">
                            {friendRequests.map(req => (
                                <div key={req.from} className="flex justify-between items-center">
                                    <p>{req.fullname} (@{req.username})</p>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handleFriendRequest(req, false)}>Decline</Button>
                                        <Button size="sm" onClick={() => handleFriendRequest(req, true)}>Accept</Button>
                                    </div>
                                </div>
                            ))}
                            {friendRequests.length === 0 && <p className="text-muted-foreground text-center">No new requests.</p>}
                        </div>
                      </ScrollArea>
                  </DialogContent>
              </Dialog>
          </SidebarMenu>

          <Separator className="my-4 bg-sidebar-border" />
          
          <SidebarMenu>
            <SidebarMenuItem>
              <p className="px-2 text-xs font-semibold text-sidebar-primary-foreground/70">Chats</p>
            </SidebarMenuItem>
            {friends.map(friend => (
              <SidebarMenuItem key={friend.uid}>
                <SidebarMenuButton onClick={() => setActiveChat(friend)} isActive={activeChat?.uid === friend.uid}>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={undefined} />
                    <AvatarFallback className="text-xs">{friend.username.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span>{friend.fullname}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="w-full justify-start">
                    <Cog className="mr-2" /> Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-full">
                <Settings user={user} profile={profile} />
            </DialogContent>
            </Dialog>
        </SidebarFooter>
      </Sidebar>
      
      <SidebarInset>
        <div className="flex flex-col h-screen">
            {activeChat ? (
            <>
                <header className="p-4 border-b flex justify-between items-center bg-background shadow-sm">
                  <div className="flex items-center gap-3">
                    <SidebarTrigger className="md:hidden" />
                    <Avatar>
                      <AvatarImage src={undefined} />
                      <AvatarFallback>{activeChat.username.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <h2 className="font-semibold">{activeChat.fullname}</h2>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <TooltipProvider>
                       <Tooltip>
                          <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={startMic} disabled={micActive}>
                                <Mic />
                              </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Start Microphone</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={createCall} disabled={!micActive || inCall}>
                                    <Phone />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Start Call</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={hangUp} disabled={!inCall}>
                                    <PhoneOff />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>End Call</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                  </div>
                </header>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex items-end gap-2 ${msg.from === user.uid ? 'justify-end' : 'justify-start'}`}>
                        {msg.from !== user.uid && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={undefined} />
                            <AvatarFallback className="text-xs">{activeChat.username.charAt(0)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={`rounded-lg p-3 max-w-md ${msg.from === user.uid ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <p className="text-sm">{msg.text}</p>
                          <p className="text-xs text-right mt-1 opacity-70">{new Date(msg.createdAt?.toDate()).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <footer className="p-4 border-t bg-background">
                  <form onSubmit={sendMessage} className="flex gap-2 items-center">
                      <Input 
                          value={newMessage} 
                          onChange={(e) => setNewMessage(e.target.value)} 
                          placeholder="Type a message..."
                          className="flex-1"
                      />
                      <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                          <Send/>
                          <span className="sr-only">Send</span>
                      </Button>
                  </form>
                </footer>
            </>
            ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-4">
                 <div className="flex items-center md:hidden">
                    <SidebarTrigger />
                 </div>
                <div className="p-4 border rounded-full bg-muted">
                    <MessageSquare size={48} className="text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-bold">Welcome to EchoVerse!</h2>
                <p className="text-muted-foreground max-w-md">Your real-time communication hub. Select a friend from the sidebar to start a conversation, or add new friends to begin your journey.</p>
            </div>
            )}
        </div>
      </SidebarInset>

       <audio ref={localAudioRef} autoPlay playsInline muted className="hidden"></audio>
       <audio ref={remoteAudioRef} autoPlay playsInline className="hidden"></audio>
    </>
  );
}
