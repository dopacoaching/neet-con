import Navbar from '../components/layout/Navbar.jsx';
import Footer from '../components/layout/Footer.jsx';
import HeroSection from '../components/landing/HeroSection.jsx';
import AboutSection from '../components/landing/AboutSection.jsx';
import ScheduleSection from '../components/landing/ScheduleSection.jsx';
import SpeakersSection from '../components/landing/SpeakersSection.jsx';
import BenefitsSection from '../components/landing/BenefitsSection.jsx';
import RegistrationCTA from '../components/landing/RegistrationCTA.jsx';

const LandingPage = () => (
  <div>
    <Navbar />
    <main>
      <HeroSection />
      <AboutSection />
      <ScheduleSection />
      <SpeakersSection />
      <BenefitsSection />
      <RegistrationCTA />
    </main>
    <Footer />
  </div>
);

export default LandingPage;
