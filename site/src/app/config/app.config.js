export const APP_CONFIG = {
  name: 'Lotmates',
  tagline: 'Buy together. Pay less.',
  emoji: '🤝',
  icon: 'UsersRound',
  defaultTheme: 'system',
  defaultLoginRoute: '/customer/login',
};

export const AUTH_PROFILES = [
  {
    key: 'admin',
    name: 'Admin_c',
    profileSlug: "|zkuIgjqmASB8iRhy0t8Xb867ByPvT+SJ6iUAsQgCWyo=",
    redirectAfterAuth: '/admin',
    authPage: {
      loginTitle: 'Admin Sign In',
      signupTitle: 'Create Admin Account',
      loginDescription: null,
      signupDescription: null,
    },
    altLinksLeadIn: 'Go to the right portal',
    altLinks: [
      { href: '/customer/login', label: 'I am Neighbour' },
      { href: '/vendor/login', label: 'I am Vendor' },
      { href: '/ambassador/login', label: 'I am Ambassador' }
    ],
    reportsTo: null,
    hasSignup: false,
  },
  {
    key: 'customer',
    name: 'Customer_c',
    profileSlug: "|zkuIgjqmASB8iRhy0t8Xb2JfVWgezFTq+CL2kB8ZuhM=",
    redirectAfterAuth: '/home',
    authPage: {
      loginTitle: 'Neighbour Sign In',
      signupTitle: 'Create Neighbour Account',
      loginDescription: null,
      signupDescription: null,
    },
    altLinksLeadIn: 'Go to the right portal',
    altLinks: [
      { href: '/admin/login', label: 'I am Admin' },
      { href: '/vendor/login', label: 'I am Vendor' },
      { href: '/ambassador/login', label: 'I am Ambassador' }
    ],
    reportsTo: "Admin_c",
    hasSignup: true,
  },
  {
    key: 'vendor',
    name: 'Vendor_c',
    profileSlug: "|zkuIgjqmASB8iRhy0t8Xb/eptPDJ/ArMy16Jnt2zk64=",
    redirectAfterAuth: '/vendor',
    authPage: {
      loginTitle: 'Vendor Sign In',
      signupTitle: 'Create Vendor Account',
      loginDescription: null,
      signupDescription: null,
    },
    altLinksLeadIn: 'Go to the right portal',
    altLinks: [
      { href: '/admin/login', label: 'I am Admin' },
      { href: '/customer/login', label: 'I am Neighbour' },
      { href: '/ambassador/login', label: 'I am Ambassador' }
    ],
    reportsTo: "Admin_c",
    hasSignup: false,
  },
  {
    key: 'ambassador',
    name: 'Ambassador_c',
    profileSlug: "|zkuIgjqmASB8iRhy0t8Xb67PMhJ5XegoYQBCzOUdNzI=",
    redirectAfterAuth: '/ambassador',
    authPage: {
      loginTitle: 'Ambassador Sign In',
      signupTitle: 'Create Ambassador Account',
      loginDescription: null,
      signupDescription: null,
    },
    altLinksLeadIn: 'Go to the right portal',
    altLinks: [
      { href: '/admin/login', label: 'I am Admin' },
      { href: '/customer/login', label: 'I am Neighbour' },
      { href: '/vendor/login', label: 'I am Vendor' }
    ],
    reportsTo: "Admin_c",
    hasSignup: false,
  }
];

export const GENERIC_AUTH = {
  loginTitle: 'Welcome back',
  signupTitle: 'Join Lotmates',
  loginDescription: null,
  signupDescription: null,
  redirectAfterAuth: '/bookings',
};
