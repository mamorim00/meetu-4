import React, { FC } from 'react';
import { Link } from 'react-router-dom'; // Use Link for internal navigation

// Privacy Policy component for Meetu
const PrivacyPolicy: FC = () => {
  return (
    <div className="bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy for Meetu</h1>
          <p className="text-muted-foreground mt-2">Last Updated: June 6, 2025</p>
        </header>

        <div className="prose prose-lg mx-auto">
          <p className="lead">
            Welcome to Meetu. We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this privacy notice, or our practices with regards to your personal information, please contact us at meetu.hub@gmail.com.
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

          <h2>6. Content and Conduct Policy</h2>
          <p>We have zero tolerance for unlawful, abusive, or objectionable content or behavior in our community. Below is a summary of our rules, which apply to all user-generated content and interactions:</p>

          <h3>a. Prohibited Content</h3>
          <ul>
            <li>Promotes discrimination, bigotry, racism, hatred, or physical harm of any kind against a person or group.</li>
            <li>Is pornographic, sexually explicit, or depicts minors in sexual activities.</li>
            <li>Encourages or depicts self-harm, suicide, or disordered eating.</li>
            <li>Involves graphic violence, threats, or glorification of animal cruelty.</li>
            <li>Promotes or depicts the use of illegal drugs or the sale of regulated goods (e.g., weapons).</li>
            <li>Is defamatory, harassing, bullying, or invades another’s privacy or publicity rights.</li>
            <li>Contains spam, phishing, or other deceptive practices.</li>
          </ul>

          <h3>b. Prohibited Conduct</h3>
          <ul>
            <li>Harassing, threatening, stalking, or harming another individual.</li>
            <li>Impersonating any person or entity or misrepresenting affiliation.</li>
            <li>Spamming, soliciting, or advertising without permission.</li>
            <li>Using bots, scrapers, or automated means to access or collect data.</li>
            <li>Reverse engineering, decompiling, or extracting source code from the app.</li>
            <li>Circumventing security measures or accessing unauthorized parts of the Service.</li>
          </ul>

          <h3>c. Moderation Tools: Reporting &amp; Blocking</h3>
          <p>To help maintain a safe community, you can:</p>
          <ul>
            <li><strong>Report:</strong> Tap the “...” menu or long-press any chat message, profile, or activity to report abuse. Our team reviews all reports within 24 hours and takes appropriate action, including suspensions or bans.</li>
            <li><strong>Block:</strong> Visit a user’s profile and select “Block User” to stop all interactions. Blocked users cannot view your content or send messages. You can unblock at any time.</li>
          </ul>

          <h3>d. Enforcement</h3>
          <p>We reserve the right to remove any content, suspend or terminate accounts, and disclose information to law enforcement as required. Repeat offenders will be permanently banned.</p>

          <h2>7. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. If we make material changes, we'll notify you via email or in-app notice at least 15 days before they take effect. Continued use after changes constitutes acceptance.</p>

          <h2>8. How Can You Contact Us About This Policy?</h2>
          <p>If you have questions or comments about this policy, email us at meetu.hub@gmail.com.</p>
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
