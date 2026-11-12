// Company details shown on every policy page and the contact page.
// Values in [brackets] are placeholders. Replace them before taking real payments.
export const COMPANY = {
  brand: 'Lotmates',
  legalName: '[Registered company name]',
  address: '[Registered office address], Chennai, Tamil Nadu [PIN]',
  email: 'support@lotmates.demo',
  phone: '+91 [support phone]',
  hours: 'Monday to Saturday, 10 am to 6 pm',
  gstin: '[GSTIN]',
  cin: '[CIN or LLPIN]',
  privacyEmail: 'privacy@lotmates.demo',
  grievance: {
    name: '[Grievance officer name]',
    designation: 'Grievance Officer',
    email: 'grievance@lotmates.demo',
    phone: '+91 [grievance phone]',
  },
  jurisdiction: 'Chennai',
  city: 'Chennai',
};

export const LAST_UPDATED = '11 November 2026';

const C = COMPANY;

export const POLICIES = [
  {
    slug: 'terms',
    title: 'Terms of use',
    icon: 'ScrollText',
    group: 'neighbours',
    summary: 'How Lotmates works, what we do, what vendors do, and the rules for using it.',
    inShort: [
      'Lotmates is a marketplace. Independent local vendors provide the services and products.',
      'We run the listings, bookings, payments, refunds and complaints.',
      'You pay the first price when you book and get the difference back when the deal closes.',
      'You must be 18 or older to book.',
    ],
    sections: [
      {
        heading: 'Who we are',
        body: [
          `Lotmates is run by ${C.legalName}, ${C.address} ("Lotmates", "we", "us"). These terms apply whenever you use the Lotmates website or app. By creating an account or booking a deal, you agree to them.`,
        ],
      },
      {
        heading: 'What Lotmates is',
        body: [
          'Lotmates lets neighbours in a community book the same service or product together, so the price drops as more homes join.',
          'Each deal is provided by an independent vendor. The vendor is responsible for the work or the product. We check every vendor before their first deal (ID, licences, references and a test job), run the booking and payment, handle refunds, and help when something goes wrong. The vendor for each deal is named on the deal page.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          {
            list: [
              'You must be 18 or older.',
              'Give accurate details, including the address where the service happens.',
              'Keep your password private. You are responsible for bookings made from your account.',
              'One account per person. Ask before booking for someone else\'s home.',
            ],
          },
        ],
      },
      {
        heading: 'How group deals work',
        body: [
          {
            list: [
              'Every deal shows its price tiers, the number of homes needed to unlock it, the booking deadline, the service window and the number of places.',
              'Everyone pays the Tier 1 price when they book, whenever they book.',
              'When the deal closes, the final price is the tier reached. You get the difference back once, to the card or UPI you paid with.',
              'If too few homes book by the deadline, the deal does not unlock and everyone gets a full refund.',
              'A price reached stays reached, even if someone cancels later.',
              'A deal may close early when every place is booked.',
            ],
          },
        ],
      },
      {
        heading: 'Prices and payments',
        body: [
          'Prices are in Indian rupees and include taxes unless the deal says otherwise. Payments are processed by Razorpay. We never see or store your full card number, CVV or UPI PIN.',
          'The vendor issues the tax invoice for the service or product. Neighbours never pay Lotmates a fee. Vendors pay us a commission.',
        ],
      },
      {
        heading: 'Cancellations, refunds and delivery',
        body: [
          'Our Refunds and cancellations policy and our Service and delivery policy form part of these terms.',
        ],
        links: [
          { to: '/legal/refunds', label: 'Refunds and cancellations' },
          { to: '/legal/delivery', label: 'Service and delivery' },
        ],
      },
      {
        heading: 'Using Lotmates fairly',
        body: [
          'Please don\'t:',
          {
            list: [
              'make fake bookings or book to block places,',
              'abuse, threaten or harass vendors, crews or neighbours,',
              'post reviews that are false, paid for, or about a job you didn\'t have,',
              'copy, scrape or resell Lotmates content or data,',
              'try to break into accounts or get around security,',
              'use another person\'s details without their permission.',
            ],
          },
        ],
      },
      {
        heading: 'When something goes wrong',
        body: [
          'Raise a complaint from your booking within 7 days of the job or delivery. We work with the vendor to fix it, and we decide on any refund. Our Complaints and grievances policy explains the steps and timelines.',
        ],
        links: [{ to: '/legal/grievance', label: 'Complaints and grievances' }],
      },
      {
        heading: 'Our responsibility',
        body: [
          'We are responsible for the parts we run: listings, bookings, payments, refunds and complaint handling. The vendor is responsible for the service or product. We remove vendors who fall below our standards.',
          'As far as the law allows, our total liability for any booking is limited to the amount you paid for that booking. Nothing in these terms limits rights you have under the Consumer Protection Act, 2019.',
        ],
      },
      {
        heading: 'Closing or suspending accounts',
        body: [
          'You can close your account at any time by writing to us. We may suspend an account that breaks these terms. Any refund you are owed is still paid.',
        ],
      },
      {
        heading: 'Changes to these terms',
        body: [
          'If we make an important change, we tell you by email or in the app at least 7 days before it applies. Bookings already made follow the terms in place when you booked.',
        ],
      },
      {
        heading: 'Law and disputes',
        body: [
          `These terms are governed by the laws of India. Please contact our Grievance Officer first. If we can't resolve it, courts in ${C.jurisdiction} have jurisdiction, and you keep your right to approach a consumer commission.`,
        ],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy policy',
    icon: 'Lock',
    group: 'neighbours',
    summary: 'What personal data we collect, why, who sees it, how long we keep it, and your rights.',
    inShort: [
      'We collect what we need to run your bookings: name, contact details, address and payment status.',
      'The vendor for your job sees your name, phone, address and date. Nobody else outside Lotmates does, apart from payment and hosting providers.',
      'We never sell your data. Razorpay handles card and UPI details, not us.',
      'You can see, correct or delete your data, and withdraw consent, at any time.',
    ],
    sections: [
      {
        heading: 'Who is responsible',
        body: [
          `${C.legalName} is the Data Fiduciary for personal data processed through Lotmates, under the Digital Personal Data Protection Act, 2023. Write to ${C.privacyEmail} or to our Grievance Officer for anything about your data.`,
        ],
      },
      {
        heading: 'What we collect',
        body: [
          {
            list: [
              'Account: name, email, phone number and password (stored as a secure hash).',
              'Bookings: your community, flat or house address, preferred date and notes for the vendor.',
              'Payments: payment and refund references, amounts and status from Razorpay. Not your card number, CVV or UPI PIN.',
              'What you send us: reviews, complaints, messages and photos.',
              'Job records: photos the vendor takes to show a job is done.',
              'Device and usage: browser type, pages visited and sign-in times, used for security and to fix problems.',
              'Vendors and ambassadors also share business details, ID and licence documents, and bank details for payouts.',
            ],
          },
        ],
      },
      {
        heading: 'Why we use it',
        body: [
          {
            list: [
              'To create and run your account.',
              'To take payments and send refunds.',
              'To give the vendor what they need to do your job.',
              'To tell you how your deals are going: price drops, closing, refunds and visit times.',
              'To handle complaints and keep vendors to our standards.',
              'To prevent fraud and keep Lotmates secure.',
              'To meet tax, accounting and other legal duties.',
            ],
          },
          'We send offers and newsletters only if you separately agree, and you can stop them at any time.',
        ],
      },
      {
        heading: 'Consent',
        body: [
          'We ask for your consent when you create an account and when you book, and we explain what it covers. You can withdraw it at any time by writing to us. Withdrawing doesn\'t undo what was done before, and we may still keep records the law requires.',
        ],
      },
      {
        heading: 'Who sees your data',
        body: [
          {
            list: [
              'The vendor for your booking: your name, phone, address, date and notes.',
              'Your community\'s ambassador: that you booked a deal and its status, so they can help with questions. Not your payment details.',
              'Razorpay, to process payments and refunds.',
              'Gravatar (gravatar.com), to show your profile picture if you have one there and haven\'t added your own. Your browser sends Gravatar a scrambled code made from your email, not the email itself. You can turn this off on your profile.',
              'Service providers who host the app and send emails or messages for us, under contracts that limit what they can do with it.',
              'Government or law enforcement, only when the law requires it.',
            ],
          },
          'We do not sell or rent personal data.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'We keep account data while your account is open. Booking and payment records are kept for as long as tax and accounting laws require, usually up to 8 years. Complaint records are kept for 3 years. After that we delete the data or make it anonymous.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          {
            list: [
              'See a summary of the personal data we hold about you and who we shared it with.',
              'Correct, complete or update it.',
              'Ask us to delete it, unless the law requires us to keep it.',
              'Withdraw consent.',
              'Nominate someone to act for you if you are unable to.',
              'Complain to our Grievance Officer, and then to the Data Protection Board of India.',
            ],
          },
          `Write to ${C.privacyEmail}. We reply within 7 days and complete requests within 30 days.`,
        ],
      },
      {
        heading: 'Security',
        body: [
          'Data is encrypted in transit. Access is limited by role: vendors see only their own jobs, and ambassadors only their own communities. Card and UPI details are handled by Razorpay. If a breach affects your data, we tell you and the authorities as the law requires.',
        ],
      },
      {
        heading: 'Children',
        body: ['Lotmates is for adults. We do not knowingly collect data from anyone under 18.'],
      },
      {
        heading: 'Cookies',
        body: ['We use only the storage needed to keep you signed in and remember your settings.'],
        links: [{ to: '/legal/cookies', label: 'Cookies and storage' }],
      },
      {
        heading: 'Changes',
        body: ['If we change how we use your data in an important way, we tell you before it applies and ask again where the law requires.'],
      },
    ],
  },
  {
    slug: 'refunds',
    title: 'Refunds and cancellations',
    icon: 'RotateCcw',
    group: 'neighbours',
    summary: 'The money-back rules: price drops, deals that don\'t unlock, cancelling, and how refunds reach you.',
    inShort: [
      'Everyone pays the Tier 1 price when they book.',
      'When the deal closes, the difference to the final price comes back to you.',
      'If the deal doesn\'t unlock, you get all of it back.',
      'Cancel free, with a full refund, any time before the deal closes.',
      'Refunds go back to the card or UPI you paid with, usually within 5 to 7 working days.',
    ],
    sections: [
      {
        heading: 'What you pay when you book',
        body: [
          'You pay the Tier 1 price for each home or item you book. Booking early never costs more than booking late, because everyone ends up paying the same final price.',
        ],
      },
      {
        heading: 'When the deal closes',
        body: [
          'The final price is the tier the deal reached by its deadline. Your refund is the Tier 1 price minus the final price, times the number you booked. We start it within 2 working days of the deadline.',
          'Example: you paid ₹3,499. The deal closes at ₹2,899. ₹600 comes back to you.',
        ],
      },
      {
        heading: 'If the deal doesn\'t unlock',
        body: [
          'If fewer homes book than the number needed, the deal is cancelled and everyone gets a full refund. We start it within 2 working days of the deadline.',
        ],
      },
      {
        heading: 'Cancelling before the deal closes',
        body: [
          'Cancel from your booking at any time before the deadline and get everything back. A price already reached stays reached for everyone else.',
        ],
      },
      {
        heading: 'Cancelling after the deal closes',
        body: [
          'After the deadline, the vendor has reserved your slot or ordered your item.',
          {
            list: [
              'Services, more than 48 hours before your visit: you get back the final price, minus any cancellation fee shown on the deal page.',
              'Services, within 48 hours of your visit, or if nobody is home: the vendor may keep up to 25% of the final price for the visit. The rest comes back to you.',
              'Products already dispatched can\'t be cancelled. See returns below.',
            ],
          },
        ],
      },
      {
        heading: 'If the vendor cancels',
        body: [
          'If the vendor can\'t do your job or deliver your item, you choose: a new date, or a full refund of what you paid.',
        ],
      },
      {
        heading: 'Problems with a job',
        body: [
          'Raise a complaint from your booking within 7 days of the job, with photos if you can. Depending on what happened, the vendor comes back to fix it at no cost, or we refund part or all of the price. We decide within 15 days.',
        ],
      },
      {
        heading: 'Products: damaged, faulty or wrong items',
        body: [
          'Report it within 48 hours of delivery, with photos. We arrange a replacement or a full refund. Faults that appear later are covered by the manufacturer\'s warranty, and we help you claim it. Unused items can\'t be returned for a change of mind unless the deal says so.',
        ],
      },
      {
        heading: 'How refunds reach you',
        body: [
          'Refunds always go back to the card, UPI or bank account you paid with. Razorpay sends them as soon as we start them. Banks usually take 5 to 7 working days, and UPI is often faster. Your booking shows the refund amount and reference.',
          `If a refund hasn't arrived within 10 working days, write to ${C.email} with your booking reference.`,
        ],
      },
      {
        heading: 'Before raising a chargeback',
        body: ['Please talk to us first. Most problems are fixed faster through your booking than through a bank dispute.'],
      },
    ],
  },
  {
    slug: 'delivery',
    title: 'Service and delivery',
    icon: 'Truck',
    group: 'neighbours',
    summary: 'When and how services are scheduled and products delivered, and what happens if a visit is missed.',
    inShort: [
      'Services happen at your home during the service window on the deal page.',
      'The vendor confirms your date and time after the deal closes.',
      'Products are delivered to your community address, usually 3 to 10 working days after the deal closes.',
      `We currently serve listed communities in ${C.city} only.`,
    ],
    sections: [
      {
        heading: 'Services at your home',
        body: [
          {
            list: [
              'Every deal shows a service window. Pick a preferred date when you book.',
              'After the deal closes, the vendor confirms your date and time at least 24 hours ahead.',
              'The crew carries ID. Someone 18 or older should be home for the visit.',
              'When the job is done, the vendor marks it done with photos and you are notified.',
            ],
          },
        ],
      },
      {
        heading: 'Rescheduling',
        body: ['You can move your visit once, free, up to 24 hours before it, to another date inside the service window.'],
      },
      {
        heading: 'Missed visits',
        body: [
          'If the vendor doesn\'t turn up, you choose a new date or a full refund. If nobody is home, our Refunds and cancellations policy applies.',
        ],
        links: [{ to: '/legal/refunds', label: 'Refunds and cancellations' }],
      },
      {
        heading: 'Products',
        body: [
          {
            list: [
              'Products are delivered to the address on your booking, usually 3 to 10 working days after the deal closes. The deal page shows the expected window.',
              'Delivery within your community is free unless the deal says otherwise.',
              'Check the package when it arrives. Report damage within 48 hours.',
            ],
          },
        ],
      },
      {
        heading: 'Where we deliver',
        body: [
          `Lotmates serves the communities listed on the site, currently in ${C.city}. We don't ship outside India.`,
        ],
      },
    ],
  },
  {
    slug: 'grievance',
    title: 'Complaints and grievances',
    icon: 'MessageSquareWarning',
    group: 'neighbours',
    summary: 'How to raise a problem, who handles it, how fast we respond, and where to go next.',
    inShort: [
      'Raise a complaint from your booking. The vendor and our team both see it.',
      'We acknowledge within 24 hours and resolve within 15 days.',
      'Our Grievance Officer is named below with contact details.',
    ],
    sections: [
      {
        heading: 'Start from your booking',
        body: [
          'Open the booking and choose "Report a problem". Add what happened and photos if you can. Including your booking reference speeds things up.',
        ],
      },
      {
        heading: 'Grievance Officer',
        body: [
          {
            list: [
              `${C.grievance.name}, ${C.grievance.designation}`,
              `${C.legalName}, ${C.address}`,
              `Email: ${C.grievance.email}`,
              `Phone: ${C.grievance.phone}`,
              `Hours: ${C.hours}`,
            ],
          },
        ],
      },
      {
        heading: 'Timelines',
        body: [
          {
            list: [
              'We acknowledge every complaint within 24 hours.',
              'We resolve it within 15 days and keep you updated along the way.',
              'Refunds agreed in a complaint are started within 2 working days.',
            ],
          },
        ],
      },
      {
        heading: 'Who the seller is',
        body: [
          'Every deal page names the vendor providing it. Their profile shows what we checked, their past deals and reviews from neighbours.',
        ],
      },
      {
        heading: 'If you\'re not satisfied',
        body: [
          'You can contact the National Consumer Helpline on 1915 or at consumerhelpline.gov.in, or file a case with a consumer commission. For data protection complaints, you can approach the Data Protection Board of India after contacting us.',
        ],
      },
    ],
  },
  {
    slug: 'reviews',
    title: 'Reviews and content',
    icon: 'Star',
    group: 'neighbours',
    summary: 'Who can post reviews, what is allowed, and how we moderate.',
    inShort: [
      'Only neighbours whose job is done can review it, once per booking.',
      'We never remove a review just because it is negative.',
      'We never pay for reviews or let vendors write their own.',
    ],
    sections: [
      {
        heading: 'Who can review',
        body: ['You can review a vendor once the job or delivery on your booking is marked done. One review per booking.'],
      },
      {
        heading: 'What\'s allowed',
        body: [
          'Tell neighbours what happened, good or bad. Please don\'t include:',
          {
            list: [
              'abuse, threats or hateful language,',
              'phone numbers, addresses or other personal details,',
              'adverts or links,',
              'claims you know are untrue.',
            ],
          },
        ],
      },
      {
        heading: 'How we moderate',
        body: [
          'We remove reviews that break these rules and tell the author why. We don\'t remove or hide reviews for being negative. Vendors can reply publicly. Reviews are shown in date order, not sorted to favour anyone.',
        ],
      },
      {
        heading: 'No fake or paid reviews',
        body: ['Vendors, ambassadors and our team cannot review deals they are part of. We don\'t offer rewards for reviews.'],
      },
      {
        heading: 'Reviews and complaints',
        body: ['A review tells neighbours about your experience. To get a problem fixed or a refund, raise a complaint from your booking as well.'],
      },
      {
        heading: 'Permission to show your review',
        body: ['By posting, you let Lotmates show your review, your first name and the deal it relates to on Lotmates. You can ask us to remove it at any time.'],
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookies and storage',
    icon: 'Cookie',
    group: 'neighbours',
    summary: 'The small amount of browser storage Lotmates uses, and why.',
    inShort: [
      'We use storage only to keep you signed in and remember settings like dark mode.',
      'No advertising or cross-site tracking cookies.',
    ],
    sections: [
      {
        heading: 'What we store',
        body: [
          {
            list: [
              'Sign-in: keeps you signed in and protects your account.',
              'Preferences: remembers your light or dark theme.',
            ],
          },
        ],
      },
      {
        heading: 'Payment pages',
        body: ['When you pay, Razorpay\'s checkout may set its own cookies to process the payment and prevent fraud. Razorpay\'s privacy policy covers those.'],
      },
      {
        heading: 'Analytics',
        body: ['We don\'t use analytics or advertising cookies today. If we add them, we\'ll ask first.'],
      },
      {
        heading: 'Clearing storage',
        body: ['You can clear cookies and site data in your browser settings at any time. You\'ll need to sign in again.'],
      },
    ],
  },
  {
    slug: 'vendors',
    title: 'Vendor terms',
    icon: 'Store',
    group: 'partners',
    summary: 'Joining, running deals, commission, payouts, service standards and customer data.',
    inShort: [
      'Vendors pay a commission on completed jobs. Neighbours never pay a fee.',
      'You honour every booking at the final price the deal reached.',
      'Payouts are weekly, once a job is done and its 7-day complaint window has passed.',
      'Customer details are for the job only.',
    ],
    sections: [
      {
        heading: 'These terms',
        body: ['These terms apply to every vendor on Lotmates. You accept them when you apply, and they apply to every deal you run.'],
      },
      {
        heading: 'Joining',
        body: [
          'Any business can apply on the vendors page. Every application is reviewed by the Lotmates team, and we get in touch with you before deciding. We may decline an application, and we don\'t have to give a reason.',
          'Before your first deal we check your ID, the licences your trade needs, references from past customers, and a test job, and verify your bank account. Your vendor account is set up only after these checks pass. New vendors start on probation, with smaller first deals.',
        ],
      },
      {
        heading: 'Running a deal',
        body: [
          {
            list: [
              'You agree the tiers, minimum homes, capacity, service window and what\'s included with our team before a deal goes live.',
              'You serve every booking at the final price the deal reached. The capacity you set is a promise.',
              'Bring ID, send verified crew, use safe materials, and follow the law for your trade.',
              'Give each customer a proper invoice, with GST if you are registered.',
            ],
          },
        ],
      },
      {
        heading: 'Commission',
        body: [
          'You pay Lotmates a commission on the final price of each completed job. The rate is agreed before the deal goes live and shown in your portal. GST applies to the commission.',
        ],
      },
      {
        heading: 'Payouts',
        body: [
          'When you mark a job done with photos, a 7-day complaint window starts. After that, the job is included in the next weekly payout to your verified bank account, minus commission and any refunds from upheld complaints. Each payout shows the jobs it covers.',
        ],
      },
      {
        heading: 'Customer data',
        body: [
          'Use customers\' names, phone numbers and addresses only to do the job. Don\'t market to them, share their details or keep them after the job. Don\'t move bookings that started on Lotmates off the platform.',
        ],
      },
      {
        heading: 'Quality and removal',
        body: [
          'We watch ratings, complaints and no-shows. If they fall below our standards, we may pause your deals, and we may remove you for serious or repeated problems. We tell you why and give you a chance to respond, except where safety is at risk.',
        ],
      },
      {
        heading: 'Responsibility',
        body: [
          'You are responsible for your work, your staff and any damage caused during a job. Keep the insurance your trade normally needs.',
        ],
      },
      {
        heading: 'Leaving',
        body: ['Either side can end this with 30 days\' notice. Jobs already booked must still be completed or refunded.'],
      },
    ],
  },
  {
    slug: 'ambassadors',
    title: 'Ambassador terms',
    icon: 'Megaphone',
    group: 'partners',
    summary: 'What ambassadors do, what they earn, and how to share deals honestly.',
    inShort: [
      'Ambassadors are neighbours who share deals and propose new ones for their community.',
      'You earn 10% of Lotmates\' commission on completed jobs in your communities, but not on your own bookings.',
      'Share honestly, and say that you earn a share when you recommend a deal.',
      'Every application is reviewed, and we speak with you before approving it.',
    ],
    sections: [
      {
        heading: 'Joining',
        body: [
          'Anyone can apply on the ambassadors page. Every application is read by the Lotmates team, and we get in touch with you before deciding. Your ambassador account is set up only after we approve you. We may decline an application, and we don\'t have to give a reason.',
          'Before your first payout, you give us your ID and bank account details so we can verify you and pay you.',
        ],
      },
      {
        heading: 'Your role',
        body: [
          'You share live deals with your community, answer questions, and propose deals your neighbours want. You are an independent partner, not an employee of Lotmates.',
        ],
      },
      {
        heading: 'What you earn',
        body: [
          'You earn 10% of the commission Lotmates receives on every completed job in the communities you run. Earnings are paid monthly to your verified bank account. TDS is deducted where the law requires.',
          'Your share comes out of Lotmates\' commission. It is never added to the price neighbours pay.',
        ],
      },
      {
        heading: 'Your own bookings',
        body: [
          'You can book any deal for your own home, like any neighbour. You don\'t earn commission on your own bookings, only on bookings by other neighbours in your communities.',
        ],
      },
      {
        heading: 'Sharing honestly',
        body: [
          {
            list: [
              'Share real deal details only: the live price, tiers and deadline.',
              'Don\'t promise a price the deal hasn\'t reached.',
              'Don\'t pressure neighbours to book.',
              'When you recommend a deal, say that you earn a share from Lotmates.',
            ],
          },
        ],
      },
      {
        heading: 'Conflicts of interest',
        body: ['Tell us if you are related to, work for, or are paid by a vendor. Don\'t propose deals with a vendor you have an interest in without telling us.'],
      },
      {
        heading: 'Neighbours\' data',
        body: ['You can see who booked in your communities and the status of each booking. Keep it private. Don\'t share or use it for anything else.'],
      },
      {
        heading: 'Leaving',
        body: ['Either side can end this at any time. Earnings on jobs already completed are still paid.'],
      },
    ],
  },
];

export function policyBySlug(slug) {
  return POLICIES.find((p) => p.slug === slug) ?? null;
}
