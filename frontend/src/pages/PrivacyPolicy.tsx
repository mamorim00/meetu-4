import React, { FC } from 'react';
import { Link } from 'react-router-dom'; // Use Link for internal navigation

// Privacy Policy component for Meetu
const PrivacyPolicy: FC = () => {
  return (
    <div className="bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy for Meetu</h1>
          <p className="text-muted-foreground mt-2">Last Updated: June 4, 2025</p>
        </header>

        <div className="prose prose-lg mx-auto">
          <p className="lead">
            Welcome to Meetu. We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this privacy notice, or our practices with regards to your personal information, please contact us.
          </p>

        

          <h2>1. What Information We Collect</h2>
          <p>We collect personal information that you voluntarily provide to us when you register on the app, express an interest in obtaining information about us or our products and services, when you participate in activities on the app or otherwise when you contact us.</p>
          
          <h2>2. How We Use Your Information</h2>
          <p>We use personal information collected via our app for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.</p>
          <ul>
            <li>To facilitate account creation and logon process.</li>
            <li>To post testimonials with your consent.</li>
            <li>To manage user accounts.</li>
            <li>To send administrative information to you.</li>
          </ul>

          <h2>3. Will Your Information Be Shared With Anyone?</h2>
          <p>We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations.</p>

          <h2>4. How Long Do We Keep Your Information?</h2>
          <p>We keep your information for as long as necessary to fulfill the purposes outlined in this privacy notice unless otherwise required by law.</p>

          <h2>5. What Are Your Privacy Rights?</h2>
          <p>In some regions (like the EEA and UK), you have certain rights under applicable data protection laws. These may include the right (i) to request access and obtain a copy of your personal information, (ii) to request rectification or erasure; (iii) to restrict the processing of your personal information; and (iv) if applicable, to data portability.</p>

          <h2>6. How Can You Contact Us About This Policy?</h2>
          <p>If you have questions or comments about this policy, you may email us at [your-contact-email@example.com].</p>
        </div>
        
        <div className="text-center mt-12">
            <Link to="/" className="text-primary hover:underline">
              &larr; Back to Home
            </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
