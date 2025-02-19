// src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, orderBy, onSnapshot, getDoc, doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import Tweet from "../components/Tweet";
import FollowButton from '../components/FollowButton';
import { useAuth } from '../context/AuthContext';
import { ReactComponent as AdminIcon } from '../icons/progress-check.svg';
import { isUserAdmin } from "../firebase";
import UserProfile from '../components/UserProfile';
import EditProfile from '../components/EditProfile';

const DEFAULT_PROFILE_IMAGE = "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png";

export default function Profile({ currentUser }) {
  const { user, setUser } = useAuth();
  const { userId } = useParams();
  const [userTweets, setUserTweets] = useState([]);
  const [likedTweets, setLikedTweets] = useState([]);
  const [retweetedTweets, setRetweetedTweets] = useState([]);
  const [profileUser, setProfileUser] = useState(null);
  const [activeTab, setActiveTab] = useState('tweets'); // Nueva variable para controlar las pestañas
  const [newPhotoURL, setNewPhotoURL] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const handlePhotoChange = async () => {
    if (!newPhotoURL) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { photoURL: newPhotoURL });
      setUser((prevUser) => ({ ...prevUser, photoURL: newPhotoURL }));
      alert('Imagen de perfil actualizada');
    } catch (error) {
      console.error('Error al actualizar la imagen de perfil:', error);
    }
  };

  useEffect(() => {
    let unsubscribeAll = [];
    
    const loadProfile = async () => {
      const targetUserId = userId || currentUser?.uid;
      if (!targetUserId) return;

      try {
        // Obtener o crear documento de usuario
        const userRef = doc(db, "users", targetUserId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
          // Si el usuario no existe, crear documento básico
          const basicUserData = {
            uid: targetUserId,
            displayName: "Usuario",
            followers: [],
            following: [],
            createdAt: serverTimestamp()
          };
          await setDoc(userRef, basicUserData);
          setProfileUser({ ...basicUserData, uid: targetUserId });
        } else {
          setProfileUser({ ...userDoc.data(), uid: targetUserId });
        }

        // Tweets propios
        const tweetsQuery = query(
          collection(db, "tweets"),
          where("userId", "==", targetUserId),
          orderBy("timestamp", "desc")
        );

        const unsubscribeUserTweets = onSnapshot(tweetsQuery, (snapshot) => {
          const tweets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log("Tweets cargados:", tweets.length);
          setUserTweets(tweets);
        }, (error) => {
          console.error("Error cargando tweets:", error);
        });

        unsubscribeAll.push(unsubscribeUserTweets);

        // Tweets con like
        const likedTweetsQuery = query(
          collection(db, "tweets"),
          where("likedBy", "array-contains", targetUserId),
          orderBy("timestamp", "desc")
        );

        const unsubscribeLikes = onSnapshot(likedTweetsQuery, (snapshot) => {
          const tweets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log("Likes cargados:", tweets.length);
          setLikedTweets(tweets);
        }, (error) => {
          console.error("Error cargando likes:", error);
        });

        unsubscribeAll.push(unsubscribeLikes);

        // Tweets retweeteados
        const retweetedQuery = query(
          collection(db, "tweets"),
          where("retweetedBy", "array-contains", targetUserId),
          orderBy("timestamp", "desc")
        );

        const unsubscribeRetweets = onSnapshot(retweetedQuery, (snapshot) => {
          const tweets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log("Retweets cargados:", tweets.length);
          setRetweetedTweets(tweets);
        }, (error) => {
          console.error("Error cargando retweets:", error);
        });

        unsubscribeAll.push(unsubscribeRetweets);

      } catch (error) {
        console.error("Error cargando perfil:", error);
      }
    };

    loadProfile();

    return () => {
      unsubscribeAll.forEach(unsubscribe => unsubscribe());
    };
  }, [userId, currentUser]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (profileUser?.uid) {
        const adminStatus = await isUserAdmin(profileUser.uid);
        setIsAdmin(adminStatus);
      }
    };
    checkAdmin();
  }, [profileUser?.uid]);

  if (!profileUser) return null;

  return (
    <div className="min-h-screen bg-[#15202B]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cabecera del perfil */}
        <div className="relative">
          {/* Banner */}
          <div className="h-48 bg-gray-800"></div>
          
          {/* Información del perfil */}
          <div className="p-4">
            {/* Avatar */}
            <div className="relative -mt-16 mb-4">
              <img
                src={profileUser.photoURL || DEFAULT_PROFILE_IMAGE}
                alt={profileUser.displayName || "Usuario"}
                className="w-32 h-32 rounded-full border-4 border-[#15202B] bg-[#15202B]"
              />
            </div>

            {/* Nombre y username (para móviles, se muestra debajo de la foto, alineado a la izquierda) */}
            <div className="mb-4">
              <div className="text-left">
                <h1 className="text-xl font-bold text-white flex items-center">
                  {profileUser?.displayName || profileUser?.username || profileUser?.email?.split('@')[0]}
                  {isAdmin && <AdminIcon className="w-4 h-4 text-blue-500 ml-2" />}
                </h1>
                <p className="text-gray-500">
                  @{(profileUser?.username || profileUser?.email?.split('@')[0])}_ {profileUser?.uid?.slice(-4)}
                </p>
              </div>
              {profileUser?.uid !== currentUser?.uid && (
                <div className="mt-2 flex gap-2">
                  <FollowButton targetUserId={profileUser?.uid} currentUser={currentUser} />
                  <Link
                    to={`/messages/${profileUser.uid}`}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded transition-colors"
                  >
                    Mensaje Privado
                  </Link>
                </div>
              )}
            </div>

            {/* Estadísticas actualizadas en fila para móviles */}
            <div className="flex flex-row justify-around text-gray-500 mb-4">
              <span>
                <b className="text-white">{userTweets.length}</b> Tweets
              </span>
              <span>
                <b className="text-white">{profileUser?.following?.length || 0}</b> Siguiendo
              </span>
              <span>
                <b className="text-white">{profileUser?.followers?.length || 0}</b> Seguidores
              </span>
            </div>

            {/* Actualizar UI: remover input y botón para cambiar imagen */}
            {profileUser?.uid === currentUser?.uid && (
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="w-full sm:w-auto py-2 px-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded transition-colors"
                >
                  {editMode ? "Cerrar edición" : "Editar perfil"}
                </button>
              </div>
            )}
            {profileUser?.uid === currentUser?.uid && editMode && (
              <div className="mt-4">
                <EditProfile />
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            className={`flex-1 py-4 text-center ${
              activeTab === 'tweets' 
                ? 'text-blue-500 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('tweets')}
          >
            Tweets
          </button>
          <button
            className={`flex-1 py-4 text-center ${
              activeTab === 'retweets' 
                ? 'text-blue-500 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('retweets')}
          >
            Retweets
          </button>
          <button
            className={`flex-1 py-4 text-center ${
              activeTab === 'likes' 
                ? 'text-blue-500 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('likes')}
          >
            Me gusta
          </button>
        </div>

        {/* Tweet lists */}
        <div>
          {activeTab === 'tweets' ? (
            userTweets.length > 0 ? (
              userTweets.map(tweet => (
                <div key={tweet.id} className="border-b border-gray-800">
                  <Tweet tweet={tweet} currentUser={currentUser} />
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                No hay tweets para mostrar
              </div>
            )
          ) : activeTab === 'retweets' ? (
            retweetedTweets.length > 0 ? (
              retweetedTweets.map(tweet => (
                <div key={tweet.id} className="border-b border-gray-800">
                  <Tweet tweet={tweet} currentUser={currentUser} />
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                No has retweeteado ningún tweet aún
              </div>
            )
          ) : (
            likedTweets.length > 0 ? (
              likedTweets.map(tweet => (
                <div key={tweet.id} className="border-b border-gray-800">
                  <Tweet tweet={tweet} currentUser={currentUser} />
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                No hay tweets que te gusten aún
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}