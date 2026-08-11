<?php

namespace Database\Seeders;

use App\Models\Page;
use Illuminate\Database\Seeder;

class LegalPagesSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->pages() as $slug => $data) {
            Page::updateOrCreate(
                ['slug' => $slug],
                [
                    'title' => $data['title'],
                    'content' => $data['content'],
                    'meta_title' => $data['title'],
                    'meta_description' => $data['meta_description'],
                    'is_active' => true,
                    'is_core' => true,
                ]
            );
        }
    }

    private function pages(): array
    {
        return [
            'privacy-policy' => [
                'title' => 'Privacy Policy',
                'meta_description' => 'Learn how PetPosture LLC collects, processes, and protects your personal information.',
                'content' => <<<'HTML'
                <p>This privacy notice for PetPosture LLC ("<strong>Company</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>"), describes how and why we might collect, store, use, and/or share ("<strong>process</strong>") your information when you use our services ("<strong>Services</strong>"), such as when you:</p>
                <ul>
                <li>Visit our website at <a href="http://petposture.com">http://petposture.com</a>, or any website of ours that links to this privacy notice</li>
                <li>Engage with us in other related ways, including any sales, marketing, or events</li>
                </ul>
                <p><strong>Questions or concerns?</strong> Reading this privacy notice will help you understand your privacy rights and choices. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at <a href="mailto:support@petposture.com">support@petposture.com</a>.</p>

                <blockquote>
                <p><strong>SUMMARY OF KEY POINTS</strong></p>
                <p><em>This summary provides key points from our privacy notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our table of contents below to find the section you are looking for.</em></p>
                <p><strong>What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with PetPosture LLC and the Services, the choices you make, and the products and features you use.</p>
                <p><strong>Do we process any sensitive personal information?</strong> We do not process sensitive personal information.</p>
                <p><strong>Do we receive any information from third parties?</strong> We do not receive any information from third parties.</p>
                <p><strong>How do we process your information?</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.</p>
                <p><strong>In what situations and with which parties do we share personal information?</strong> We may share information in specific situations and with specific third parties.</p>
                </blockquote>

                <h2>1. WHAT INFORMATION DO WE COLLECT?</h2>
                <p><em><strong>In Short:</strong> We collect personal information that you provide to us.</em></p>
                <p>We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.</p>
                <h3>Personal Information Provided by You</h3>
                <p>The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:</p>
                <ul>
                <li>names</li>
                <li>phone numbers</li>
                <li>email addresses</li>
                <li>mailing addresses</li>
                <li>job titles</li>
                <li>billing addresses</li>
                <li>debit/credit card numbers</li>
                </ul>

                <h2>2. HOW DO WE PROCESS YOUR INFORMATION?</h2>
                <p><em><strong>In Short:</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.</em></p>
                <p>We process your personal information for a variety of reasons, depending on how you interact with our Services, including:</p>
                <ul>
                <li>To facilitate account creation and authentication and otherwise manage user accounts.</li>
                <li>To deliver and facilitate delivery of services to the user.</li>
                <li>To respond to user inquiries/offer support to users.</li>
                <li>To send administrative information to you.</li>
                <li>To fulfill and manage your orders.</li>
                <li>To enable user-to-user communications.</li>
                <li>To request feedback.</li>
                <li>To send you marketing and promotional communications.</li>
                <li>To protect our Services.</li>
                </ul>

                <h2>3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</h2>
                <p><em><strong>In Short:</strong> We may share information in specific situations described in this section and/or with the following third parties.</em></p>
                <p>We may need to share your personal information in the following situations:</p>
                <ul>
                <li><strong>Business Transfers.</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
                <li><strong>Affiliates.</strong> We may share your information with our affiliates, in which case we will require those affiliates to honor this privacy notice.</li>
                </ul>

                <h2>4. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?</h2>
                <p><em><strong>In Short:</strong> We may use cookies and other tracking technologies to collect and store your information.</em></p>
                <p>We may use cookies and similar tracking technologies (like web beacons and pixels) to access or store information. Specific information about how we use such technologies and how you can refuse certain cookies is set out in our Cookie Notice.</p>

                <h2>5. HOW DO WE HANDLE YOUR SOCIAL LOGINS?</h2>
                <p><em><strong>In Short:</strong> If you choose to register or log in to our Services using a social media account, we may have access to certain information about you.</em></p>
                <p>Our Services offer you the ability to register and log in using your third-party social media account details (like your Facebook or Twitter logins). Where you choose to do this, we will receive certain profile information about you from your social media provider.</p>

                <h2>6. IS YOUR INFORMATION TRANSFERRED INTERNATIONALLY?</h2>
                <p><em><strong>In Short:</strong> We may transfer, store, and process your information in countries other than your own.</em></p>
                <p>Our servers are located in the United States. If you are accessing our Services from outside the United States, please be aware that your information may be transferred to, stored, and processed by us in our facilities and by those third parties with whom we may share your personal information.</p>

                <h2>7. HOW LONG DO WE KEEP YOUR INFORMATION?</h2>
                <p><em><strong>In Short:</strong> We keep your information for as long as necessary to fulfill the purposes outlined in this privacy notice unless otherwise required by law.</em></p>
                <p>We will only keep your personal information for as long as it is necessary for the purposes set out in this privacy notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements).</p>

                <h2>8. DO WE COLLECT INFORMATION FROM MINORS?</h2>
                <p><em><strong>In Short:</strong> We do not knowingly collect data from or market to children under 18 years of age.</em></p>
                <p>We do not knowingly solicit data from or market to children under 18 years of age. By using the Services, you represent that you are at least 18 or that you are the parent or guardian of such a minor and consent to such minor dependent's use of the Services.</p>

                <h2>9. WHAT ARE YOUR PRIVACY RIGHTS?</h2>
                <p><em><strong>In Short:</strong> You may review, change, or terminate your account at any time.</em></p>
                <p>If you are located in the EEA or UK and you believe we are unlawfully processing your personal information, you also have the right to complain to your local data protection supervisory authority.</p>

                <h2>10. CONTROLS FOR DO-NOT-TRACK FEATURES</h2>
                <p>Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track ("DNT") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected.</p>

                <h2>11. DO WE MAKE UPDATES TO THIS NOTICE?</h2>
                <p><em><strong>In Short:</strong> Yes, we will update this notice as necessary to stay compliant with relevant laws.</em></p>
                <p>We may update this privacy notice from time to time. The updated version will be indicated by an updated "Revised" date and the updated version will be effective as soon as it is accessible.</p>

                <h2>12. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</h2>
                <p>If you have questions or comments about this notice, you may email us at <a href="mailto:support@petposture.com">support@petposture.com</a> or by post to:</p>
                <p><strong>PetPosture LLC</strong><br>2017 I St A<br>Sacramento, CA 95811<br>United States</p>

                <h2>13. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</h2>
                <p>Based on the applicable laws of your country, you may have the right to request access to the personal information we collect from you, change that information, or delete it. To request to review, update, or delete your personal information, please visit: <a href="mailto:support@petposture.com">support@petposture.com</a>.</p>

                <h2>14. YOUR U.S. STATE PRIVACY RIGHTS</h2>
                <p><em><strong>In Short:</strong> We do not sell or share your personal information, and residents of California and other U.S. states have rights over the personal information we collect.</em></p>
                <p><strong>We do not sell your personal information.</strong> We have not sold or shared (as those terms are defined under the California Consumer Privacy Act, as amended by the California Privacy Rights Act, and similar U.S. state privacy laws) any personal information in the preceding 12 months, and we do not use your personal information for cross-context behavioral advertising.</p>
                <p>If you are a resident of California or another U.S. state with a comprehensive privacy law, you may have the right to:</p>
                <ul>
                <li>Know what personal information we have collected about you and why.</li>
                <li>Request deletion of personal information we have collected from you.</li>
                <li>Correct inaccurate personal information we maintain about you.</li>
                <li>Opt out of the sale or sharing of your personal information, or its use for targeted advertising (though, as noted above, we do not currently engage in either).</li>
                <li>Not be discriminated against for exercising any of these rights.</li>
                </ul>
                <p>To exercise any of these rights, please contact us at <a href="mailto:support@petposture.com">support@petposture.com</a>. We will verify your request and respond within the timeframe required by applicable law.</p>
                HTML,
            ],

            'terms-and-conditions' => [
                'title' => 'Terms and Conditions',
                'meta_description' => 'The terms and conditions governing your use of the PetPosture website and services.',
                'content' => <<<'HTML'
                <p>These Terms and Conditions ("<strong>Terms</strong>") constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("<strong>you</strong>") and PetPosture LLC ("<strong>Company</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>"), concerning your access to and use of the <a href="http://petposture.com">http://petposture.com</a> website as well as any other media form, media channel, mobile website or mobile application related, linked, or otherwise connected thereto (collectively, the "<strong>Site</strong>").</p>
                <p>You agree that by accessing the Site, you have read, understood, and agreed to be bound by all of these Terms and Conditions. <strong>IF YOU DO NOT AGREE WITH ALL OF THESE TERMS AND CONDITIONS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SITE AND YOU MUST DISCONTINUE USE IMMEDIATELY.</strong></p>

                <h2>1. OUR SERVICES</h2>
                <p><em><strong>In Short:</strong> We provide ergonomic pet solutions and informative content regarding pet health and posture.</em></p>
                <p>The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country.</p>

                <h2>2. INTELLECTUAL PROPERTY RIGHTS</h2>
                <p><em><strong>In Short:</strong> We are the owner or the licensee of all intellectual property rights in our Services.</em></p>
                <p>Unless otherwise indicated, the Site is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site (collectively, the "Content") and the trademarks, service marks, and logos contained therein (the "Marks") are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws.</p>

                <h2>3. USER REPRESENTATIONS</h2>
                <p>By using the Site, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Terms and Conditions.</p>

                <h2>4. PROHIBITED ACTIVITIES</h2>
                <p>You may not access or use the Site for any purpose other than that for which we make the Site available. The Site may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.</p>

                <h2>5. USER-GENERATED CONTRIBUTIONS</h2>
                <p>The Site may invite you to chat, contribute to, or participate in blogs, message boards, online forums, and other functionality, and may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the Site.</p>

                <h2>6. CONTRIBUTION LICENSE</h2>
                <p>By posting your Contributions to any part of the Site, you automatically grant, and you represent and warrant that you have the right to grant, to us an unrestricted, unlimited, irrevocable, perpetual, non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and license to host, use, copy, reproduce, and disclose.</p>

                <h2>7. SERVICES MANAGEMENT</h2>
                <p>We reserve the right, but not the obligation, to: (1) monitor the Site for violations of these Terms and Conditions; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Terms and Conditions.</p>

                <h2>8. TERM AND TERMINATION</h2>
                <p>These Terms and Conditions shall remain in full force and effect while you use the Site. WITHOUT LIMITING ANY OTHER PROVISION OF THESE TERMS AND CONDITIONS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SITE.</p>

                <h2>9. MODIFICATIONS AND INTERRUPTIONS</h2>
                <p>We reserve the right to change, modify, or remove the contents of the Site at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Site.</p>

                <h2>10. GOVERNING LAW</h2>
                <p>These Terms and Conditions and your use of the Site are governed by and construed in accordance with the laws of the State of California applicable to agreements made and to be entirely performed within the State of California, without regard to its conflict of law principles.</p>

                <h2>11. DISPUTE RESOLUTION</h2>
                <h3>Binding Arbitration</h3>
                <p>If the Parties are unable to resolve a Dispute through informal negotiations, the Dispute (except those Disputes expressly excluded below) will be finally and exclusively resolved by binding arbitration.</p>

                <h2>12. CORRECTIONS</h2>
                <p>There may be information on the Site that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, availability, and various other information. We reserve the right to correct any errors, inaccuracies, or omissions and to change or update the information on the Site at any time, without prior notice.</p>

                <h2>13. DISCLAIMER</h2>
                <p><strong>THE SITE IS PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SITE AND OUR SERVICES WILL BE AT YOUR SOLE RISK.</strong></p>

                <h2>14. LIMITATIONS OF LIABILITY</h2>
                <p>IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SITE.</p>

                <h2>15. INDEMNIFICATION</h2>
                <p>You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys' fees and expenses, made by any third party due to or arising out of: (1) use of the Site; (2) breach of these Terms and Conditions.</p>

                <h2>16. USER DATA</h2>
                <p>We will maintain certain data that you transmit to the Site for the purpose of managing the performance of the Site, as well as data relating to your use of the Site. Although we perform regular routine backups of data, you are solely responsible for all data that you transmit or that relates to any activity you have undertaken using the Site.</p>

                <h2>17. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES</h2>
                <p>Visiting the Site, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically, via email and on the Site, satisfy any legal requirement that such communication be in writing.</p>

                <h2>18. MISCELLANEOUS</h2>
                <p>These Terms and Conditions and any policies or operating rules posted by us on the Site or in respect to the Site constitute the entire agreement and understanding between you and us. Our failure to exercise or enforce any right or provision of these Terms and Conditions shall not operate as a waiver of such right or provision.</p>

                <h2>19. AFFILIATE DISCLOSURE</h2>
                <p><em><strong>In Short:</strong> Some links on the Site are affiliate links, and we may earn a commission from qualifying purchases at no extra cost to you.</em></p>
                <p>Certain content on the Site, including product comparisons and buying guides, contains affiliate links to third-party retailers. If you make a purchase through one of these links, we may receive a commission. This does not affect the price you pay. See our <a href="/affiliate-disclosure">Affiliate Disclosure</a> for full details.</p>

                <h2>20. CONTACT US</h2>
                <p>In order to resolve a complaint regarding the Site or to receive further information regarding use of the Site, please contact us at:</p>
                <p><strong>PetPosture LLC</strong><br>2017 I St A<br>Sacramento, CA 95811<br>United States<br>Email: <a href="mailto:support@petposture.com">support@petposture.com</a></p>
                HTML,
            ],

            'cookie-policy' => [
                'title' => 'Cookie Policy',
                'meta_description' => 'How PetPosture uses cookies and similar tracking technologies, and how to control them.',
                'content' => <<<'HTML'
                <p>This Cookie Policy explains how PetPosture LLC ("<strong>Company</strong>," "<strong>we</strong>," "<strong>us</strong>," and "<strong>our</strong>") uses cookies and similar technologies to recognize you when you visit our website at <a href="http://petposture.com">http://petposture.com</a> ("<strong>Website</strong>"). It explains what these technologies are and why we use them, as well as your rights to control our use of them.</p>
                <p>In some cases we may use cookies to collect personal information, or that becomes personal information if we combine it with other information.</p>

                <h2>1. WHAT ARE COOKIES?</h2>
                <p>Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners in order to make their websites work, or to work more efficiently, as well as to provide reporting information.</p>
                <p>Cookies set by the website owner (in this case, PetPosture LLC) are called "first-party cookies." Cookies set by parties other than the website owner are called "third-party cookies."</p>

                <h2>2. WHY DO WE USE COOKIES?</h2>
                <p>We use first- and third-party cookies for several reasons. Some cookies are required for technical reasons in order for our Website to operate, and we refer to these as "essential" or "strictly necessary" cookies. Other cookies also enable us to track and target the interests of our users to enhance the experience on our Online Sections. Third parties serve cookies through our Website for advertising, analytics, and other purposes.</p>

                <h2>3. HOW CAN I CONTROL COOKIES?</h2>
                <p>You have the right to decide whether to accept or reject cookies. When you first visit our Website, a cookie banner lets you choose <strong>Accept All</strong> or <strong>Customize</strong> your preferences by category:</p>
                <ul>
                <li><strong>Essential cookies</strong> (always on) — required to keep your cart and account signed in. These cannot be disabled.</li>
                <li><strong>Analytics cookies</strong> (off by default) — used to understand site traffic via Google Analytics. These only load after you opt in.</li>
                </ul>
                <p>Your choice is saved in your browser and respected on future visits. If your browser sends a Global Privacy Control (GPC) signal, we automatically treat it as a request to opt out of non-essential cookies and will not show the banner.</p>
                <p>You can change your preferences at any time using the cookie settings link in our website footer.</p>

                <h2>4. HOW CAN I CONTROL COOKIES ON MY BROWSER?</h2>
                <p>As the means by which you can refuse cookies through your web browser controls vary from browser to browser, you should visit your browser's help menu for more information. The following is information about how to manage cookies on the most popular browsers:</p>
                <ul>
                <li>Chrome</li>
                <li>Internet Explorer</li>
                <li>Firefox</li>
                <li>Safari</li>
                <li>Edge</li>
                <li>Opera</li>
                </ul>

                <h2>5. WHAT ABOUT OTHER TRACKING TECHNOLOGIES, LIKE WEB BEACONS?</h2>
                <p>Cookies are not the only way to recognize or track visitors to a website. We may use other, similar technologies from time to time, like web beacons (sometimes called "tracking pixels" or "clear gifs"). These are tiny graphics files that contain a unique identifier that enables us to recognize when someone has visited our Website or opened an email including them.</p>

                <h2>6. DO YOU USE FLASH COOKIES OR LOCAL SHARED OBJECTS?</h2>
                <p>Websites may also use so-called "Flash Cookies" (also known as Local Shared Objects or "LSOs") to, among other things, collect and store information about your use of our services, fraud prevention, and for other site operations.</p>

                <h2>7. DO YOU SERVE TARGETED ADVERTISING?</h2>
                <p>Third parties may serve cookies on your computer or mobile device to serve advertising through our Website. These companies may use information about your visits to this and other websites in order to provide relevant advertisements about goods and services that you may be interested in.</p>

                <h2>8. HOW OFTEN WILL YOU UPDATE THIS COOKIE POLICY?</h2>
                <p>We may update this Cookie Policy from time to time in order to reflect, for example, changes to the cookies we use or for other operational, legal, or regulatory reasons. Please therefore re-visit this Cookie Policy regularly to stay informed about our use of cookies and related technologies.</p>

                <h2>9. WHERE CAN I GET FURTHER INFORMATION?</h2>
                <p>If you have any questions about our use of cookies or other technologies, please email us at <a href="mailto:support@petposture.com">support@petposture.com</a> or by post to:</p>
                <p><strong>PetPosture LLC</strong><br>2017 I St A<br>Sacramento, CA 95811<br>United States<br>Phone: +1 (916) 623-5368</p>
                HTML,
            ],

            'acceptable-use-policy' => [
                'title' => 'Acceptable Use Policy',
                'meta_description' => 'Rules for acceptable use of the PetPosture website and services.',
                'content' => <<<'HTML'
                <h2>1. WHO WE ARE</h2>
                <p>PetPosture LLC ("<strong>Company</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>") is a company registered in the United States at 2017 I St A, Sacramento, CA 95811. We operate the website http://petposture.com (the "<strong>Site</strong>"), and any other related products and services that refer or link to this Acceptable Use Policy (collectively, the "<strong>Services</strong>").</p>

                <h2>2. USE OF THE SERVICES</h2>
                <p>When you use the Services, you agree to abide by this Acceptable Use Policy and our Terms and Conditions. You may not use the Services:</p>
                <ul>
                <li>In any way that breaches any applicable local, national, or international law or regulation.</li>
                <li>In any way that is unlawful or fraudulent, or has any unlawful or fraudulent purpose or effect.</li>
                <li>For the purpose of harming or attempting to harm minors in any way.</li>
                <li>To send, knowingly receive, upload, download, use, or re-use any material which does not comply with our content standards.</li>
                <li>To transmit, or procure the sending of, any unsolicited or unauthorized advertising or promotional material or any other form of similar solicitation (spam).</li>
                <li>To knowingly transmit any data, send or upload any material that contains viruses, Trojan horses, worms, time-bombs, keystroke loggers, spyware, adware, or any other harmful programs.</li>
                </ul>

                <h2>3. CONTRIBUTIONS</h2>
                <p>Any content you upload to our Services will be considered non-confidential and non-proprietary. You must ensure that your contributions:</p>
                <ul>
                <li>Are accurate (where they state facts).</li>
                <li>Are genuinely held (where they state opinions).</li>
                <li>Comply with applicable law in the United States and in any country from which they are posted.</li>
                </ul>

                <h2>4. REVIEW AND RATINGS</h2>
                <p>When posting a review or rating, you must ensure that:</p>
                <ul>
                <li>You have firsthand experience with the person/entity being reviewed.</li>
                <li>Your review does not contain offensive profanity, or abusive, racist, offensive, or hate language.</li>
                <li>Your review does not contain discriminatory references based on religion, race, gender, national origin, age, marital status, sexual orientation, or disability.</li>
                </ul>

                <h2>5. REPORTING A BREACH OF THIS POLICY</h2>
                <p>If you wish to report a breach of this Policy, please contact us at <a href="mailto:support@petposture.com">support@petposture.com</a>. We will review the report and take appropriate action in accordance with this Policy.</p>

                <h2>6. CONSEQUENCES OF BREACHING THIS POLICY</h2>
                <p>Failure to comply with this Acceptable Use Policy constitutes a material breach of the Terms and Conditions upon which you are permitted to use the Services, and may result in our taking all or any of the following actions:</p>
                <ul>
                <li>Immediate, temporary, or permanent withdrawal of your right to use the Services.</li>
                <li>Immediate, temporary, or permanent removal of any Contribution uploaded by you to the Services.</li>
                <li>Issuance of a warning to you.</li>
                <li>Legal proceedings against you for reimbursement of all costs on an indemnity basis (including, but not limited to, reasonable administrative and legal costs) resulting from the breach.</li>
                </ul>

                <h2>7. HOW CAN YOU CONTACT US ABOUT THIS POLICY?</h2>
                <p>If you have any further questions or comments, you may contact us at:</p>
                <p><strong>PetPosture LLC</strong><br>2017 I St A<br>Sacramento, CA 95811<br>United States<br>Email: <a href="mailto:support@petposture.com">support@petposture.com</a></p>
                HTML,
            ],

            'affiliate-disclosure' => [
                'title' => 'Affiliate Disclosure',
                'meta_description' => 'How PetPosture discloses and handles affiliate marketing relationships.',
                'content' => <<<'HTML'
                <p>PetPosture LLC ("<strong>Company</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>") participates in affiliate marketing programs, which means some links and product recommendations on our website and blog may be affiliate links.</p>

                <h2>1. AFFILIATE DISCLOSURE</h2>
                <p><em><strong>In Short:</strong> Some links on our Site are affiliate links. If you make a purchase through one, we may earn a commission at no extra cost to you.</em></p>
                <p>Certain articles, product comparisons, and buying guides on our Site contain links to third-party retailers and marketplaces (such as Amazon, Chewy, Petco, PetSmart, and Walmart). Some of these are affiliate links, meaning that if you click through and make a purchase, PetPosture LLC may receive a small commission from the retailer. This comes at no additional cost to you — the price you pay is the same whether or not you use our link.</p>

                <h2>2. HOW AFFILIATE LINKS WORK</h2>
                <p>When you click an affiliate link on our Site, a cookie or tracking parameter provided by the retailer or its affiliate network may be placed in your browser so that, if you complete a purchase, the retailer can attribute the resulting commission to us. We do not control, and are not responsible for, the privacy practices of these third-party retailers or affiliate networks. Please review their respective privacy policies before making a purchase.</p>

                <h2>3. OUR EDITORIAL COMMITMENT</h2>
                <p>Whether or not a link is an affiliate link has no bearing on our editorial opinions. We recommend products based on genuine research and, where possible, real-world use, not on which link pays the highest commission. Affiliate relationships do not influence the content of our reviews, comparisons, or recommendations.</p>

                <h2>4. FTC COMPLIANCE</h2>
                <p>This disclosure is provided in accordance with the Federal Trade Commission's 16 CFR Part 255, "Guides Concerning the Use of Endorsements and Testimonials in Advertising." Wherever an individual post contains affiliate links, we also include an in-context notice directly on that page.</p>

                <h2>5. HOW CAN YOU CONTACT US ABOUT THIS DISCLOSURE?</h2>
                <p>If you have questions about our affiliate relationships, you may email us at <a href="mailto:support@petposture.com">support@petposture.com</a> or by post to:</p>
                <p><strong>PetPosture LLC</strong><br>2017 I St A<br>Sacramento, CA 95811<br>United States</p>
                HTML,
            ],

            'shipping-policy' => [
                'title' => 'Shipping Policy',
                'meta_description' => 'Order processing times, shipping zones, rates, and tracking information for PetPosture orders.',
                'content' => <<<'HTML'
                <h2>1. ORDER PROCESSING TIME</h2>
                <p>At PetPosture, we strive to get your orders ready as quickly as possible. All orders are processed and prepared for shipment within <strong>2 – 4 business days</strong> (Monday – Friday, excluding public holidays) after your order is confirmed.</p>
                <p><em>Please note: Processing time is in addition to the transit time required for delivery.</em></p>

                <h2>2. SHIPPING TIME & ZONES</h2>
                <p>Currently, PetPosture ships exclusively to the <strong>48 contiguous United States</strong>. We do not ship to Alaska, Hawaii, P.O. Boxes, or APO/FPO addresses at this time.</p>
                <ul>
                <li><strong>Transit Time:</strong> Typically <strong>3 – 8 business days</strong> for domestic shipping within the US.</li>
                <li><strong>Total Estimated Delivery:</strong> You can expect your ergonomic pet essentials to arrive within <strong>7 – 10 business days</strong> from the date of your order.</li>
                </ul>

                <h2>3. SHIPPING RATES</h2>
                <p>Shipping costs are calculated dynamically at checkout based on the total weight of the items in your cart and the specific delivery destination. We work with major carriers to ensure common-sense pricing and safe delivery of your products.</p>

                <h2>4. TRACKING & WAREHOUSES</h2>
                <p>As soon as your package leaves our warehouse, we will send you a shipping confirmation email containing a tracking number so you can follow its journey.</p>
                <p><strong>Multiple Shipments:</strong> Because PetPosture partners with specialized manufacturers and warehouses across the US to ensure the best quality, your order might arrive in separate packages. Each package will have its own tracking number if shipped separately.</p>

                <h2>5. LOST OR UNDELIVERED PACKAGES</h2>
                <p>Occasionally a package may be marked as delivered by the carrier but not received, or delayed significantly beyond the estimated delivery window. If this happens:</p>
                <ul>
                <li><strong>Tracking shows "Delivered" but you haven't received it:</strong> Please wait 24–48 hours, as carriers sometimes scan a package as delivered slightly before it physically arrives. Check with neighbors or your building's front desk/mailroom.</li>
                <li><strong>Contact us within 7 days:</strong> If the package still hasn't turned up, email <a href="mailto:support@petposture.com">support@petposture.com</a> with your order number. We will open an investigation/claim with the carrier.</li>
                <li><strong>Resolution:</strong> Once the carrier confirms the package is lost, we will send a free replacement or issue a full refund, at your choice — no restocking fee applies, since this isn't a return.</li>
                <li>Orders significantly delayed beyond the estimated delivery window (see Section 2) can also be reported to our support team for a status update.</li>
                </ul>

                <h2>6. CONTACT INFORMATION</h2>
                <p>Our dedicated support team is here to help with any shipping-related questions or concerns:</p>
                <p><strong>Email:</strong> <a href="mailto:support@petposture.com">support@petposture.com</a></p>
                <p><strong>Phone:</strong> +1 (916) 668-0065</p>
                <p><strong>Operating Hours:</strong> 10:00 AM – 20:00 PM (Monday – Friday)</p>
                <p>PetPosture LLC<br>2017 I STA, Sacramento, CA 95811</p>

                <h2>7. FREQUENTLY ASKED QUESTIONS</h2>
                <h3>Why did I only receive part of my order?</h3>
                <p>PetPosture partners with specialized manufacturers and warehouses across the US. Because of this, your items may be shipped from different locations and arrive at different times in separate packages. Each package will have its own tracking number.</p>
                <h3>How long will it really take to get my order?</h3>
                <p>Please allow 2-4 business days for processing plus 3-8 business days for shipping. In total, most customers receive their order within 7-10 business days.</p>
                <h3>Do you ship to Alaska, Hawaii, or P.O. Boxes?</h3>
                <p>Currently, we only ship to the 48 contiguous United States. We do not ship to Alaska, Hawaii, P.O. Boxes, or APO/FPO addresses.</p>
                HTML,
            ],

            'return-refund-policy' => [
                'title' => 'Return & Refund Policy',
                'meta_description' => 'PetPosture\'s return window, conditions, fees, and refund process.',
                'content' => <<<'HTML'
                <h2>1. RETURN WINDOW & REPORTING</h2>
                <p>We want you and your pet to be completely satisfied with your purchase. If for any reason you are not, we offer a <strong>30-day return window</strong> from the date of delivery.</p>
                <blockquote>
                <p><strong>Important regarding Damaged or Defective items:</strong></p>
                <p>Any items that arrive damaged or defective must be reported to our support team within <strong>7 days</strong> of delivery. Reporting within this timeframe ensures you are eligible for return shipping reimbursement.</p>
                </blockquote>

                <h2>2. HOW TO REQUEST A RETURN</h2>
                <p>Start your return online at <a href="/returns">petposture.com/returns</a> using your order number and the email address from checkout. Select the item(s), quantity, and reason for the return.</p>
                <p>Once approved, you'll receive an email with your <strong>Return Merchandise Authorization (RMA)</strong> number and the correct return address for that item. You'll then have <strong>7 days</strong> from approval to ship the item back and enter your return tracking number.</p>
                <p>Please do not ship items back without an approved RMA number, as these shipments cannot be tracked by our system and will not be eligible for a refund.</p>

                <h2>3. RETURN CONDITIONS</h2>
                <p>To be eligible for a refund, returned items must meet the following criteria:</p>
                <ul>
                <li>Must be in <strong>original, new, and unused condition</strong>.</li>
                <li>Must be free of <strong>pet hair</strong>, stains, odors, or any signs of use.</li>
                <li>Include all <strong>original packaging, tags, and accessories</strong>.</li>
                <li>Items damaged by the customer or missing original components are non-returnable.</li>
                </ul>

                <h2>4. COSTS AND FEES</h2>
                <h3>Restocking Fee</h3>
                <p>A <strong>25% restocking fee</strong> is charged on all returns. This fee covers the inspection, professional cleaning, and repackaging required by our suppliers to maintain hygiene standards for pet products.</p>
                <h3>Shipping Costs</h3>
                <p>Original shipping charges are <strong>non-refundable</strong>.</p>
                <p>For "Buyer's Remorse" returns (e.g., changed mind, wrong size/color), the customer is responsible for the return shipping costs. For confirmed defective or incorrect items reported within 7 days, contact us at <a href="mailto:support@petposture.com">support@petposture.com</a> and we will reimburse your return shipping cost.</p>

                <h2>5. REFUND PROCESS</h2>
                <p>Once your return is received at the designated supplier warehouse, it undergoes a thorough inspection which typically takes <strong>3–5 business days</strong>.</p>
                <p>Upon approval, your refund (minus the original shipping and the 25% restocking fee) will be processed back to your original payment method. Please note that it may take additional time for your bank or credit card company to post the refund to your statement.</p>

                <h2>6. LOGISTICS & CONTACT</h2>
                <p>Because PetPosture partners with specialized warehouses across the US, items from different categories may need to be returned to different locations.</p>
                <p><strong>Do not send returns to our Sacramento administrative office.</strong></p>
                <p>We will provide you with the correct warehouse address during the RMA process. If you have any questions, please reach out:</p>
                <p><strong>Support Email:</strong> <a href="mailto:support@petposture.com">support@petposture.com</a></p>
                <p><strong>Support Phone:</strong> +1 (916) 668-0065</p>

                <h2>7. FREQUENTLY ASKED QUESTIONS</h2>
                <h3>What is a 25% restocking fee?</h3>
                <p>The restocking fee covers the costs associated with processing a return, including inspection, professional cleaning, and repackaging by our suppliers to maintain hygiene standards for pet gear.</p>
                <h3>Why do I have to pay for return shipping?</h3>
                <p>For returns due to change of mind (buyer's remorse), customers are responsible for shipping costs. This helps us maintain competitive product prices for everyone. We cover shipping for defective or incorrect items reported within 7 days.</p>
                <h3>How do I return items from different brands?</h3>
                <p>Submit a return request online at petposture.com/returns for each item. Because items ship from different warehouses, we will assign a separate RMA number and return address for each one once approved. Please do not send items back without an approved RMA number.</p>
                HTML,
            ],
        ];
    }
}
