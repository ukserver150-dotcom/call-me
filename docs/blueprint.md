# **App Name**: EchoVerse

## Core Features:

- Room Creation: Allows a user to create a unique room and receive a Room ID.
- Room Joining: Allows a user to enter a Room ID and join an existing room for audio call and chat.
- Real-time Audio Call: Establishes a real-time, peer-to-peer audio connection between users in the same room using WebRTC.
- Real-time Chat: Enables real-time text-based chat between users in the same room, with messages stored in and updated via Firestore.
- Firebase Signaling: Uses Firebase Realtime Database to manage WebRTC signaling (offer, answer, ICE candidates) for call setup.
- Hangup Functionality: Allows either user to terminate the audio call.

## Style Guidelines:

- Primary color: Soft blue (#A0D2EB) to create a calming and reliable communication environment.
- Background color: Very light blue (#F0F8FF) to provide a clean and unobtrusive backdrop.
- Accent color: Pale violet (#B5838D) to provide subtle contrast and highlight interactive elements.
- Font: 'PT Sans', a humanist sans-serif suitable for both headlines and body text, giving the interface a modern yet accessible feel.