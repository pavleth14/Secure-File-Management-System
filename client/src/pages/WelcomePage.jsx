import { useAuth } from '../context/AuthContext';
import Main_1 from '../assets/Main_1.mp4';

export default function WelcomePage() {
  const { user } = useAuth();

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={Main_1} type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-black/40" />

      <h1 className="relative z-10 px-4 text-center text-4xl font-bold text-white md:text-5xl">
        Welcome, {user?.name}
      </h1>
    </div>
  );
}
