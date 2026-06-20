import Navbar from '../components/layout/Navbar.jsx';
import Footer from '../components/layout/Footer.jsx';
import HeroSection from '../components/landing/HeroSection.jsx';
import AboutSection from '../components/landing/AboutSection.jsx';
import ScheduleSection from '../components/landing/ScheduleSection.jsx';
import SpeakersSection from '../components/landing/SpeakersSection.jsx';
import BenefitsSection from '../components/landing/BenefitsSection.jsx';
import RegistrationCTA from '../components/landing/RegistrationCTA.jsx';
import StickyRegisterButton from '../components/ui/StickyRegisterButton.jsx';

const LandingPage = () => (
  <div className="pb-20 md:pb-0">
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
    <StickyRegisterButton />
  </div>
);

export default LandingPage;
