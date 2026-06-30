import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00d4aa',
      light: '#33dfbb',
      dark: '#00a888',
      contrastText: '#0a0e17',
    },
    secondary: {
      main: '#00b4d8',
      light: '#48cae4',
      dark: '#0077b6',
      contrastText: '#ffffff',
    },
    success: {
      main: '#00d4aa',
      light: '#33dfbb',
      dark: '#00a888',
    },
    error: {
      main: '#ef476f',
      light: '#ff6b8a',
      dark: '#d62839',
    },
    warning: {
      main: '#ffd166',
      light: '#ffdc85',
      dark: '#e5a820',
    },
    info: {
      main: '#00b4d8',
      light: '#48cae4',
      dark: '#0077b6',
    },
    background: {
      default: '#0a0e17',
      paper: '#111827',
    },
    divider: 'rgba(255,255,255,0.08)',
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
      disabled: '#64748b',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    h1: { fontSize: '3rem', fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.3 },
    h3: { fontSize: '1.875rem', fontWeight: 600, lineHeight: 1.3 },
    h4: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.5 },
    subtitle1: { fontSize: '1rem', fontWeight: 400, color: '#94a3b8' },
    subtitle2: { fontSize: '0.875rem', fontWeight: 400, color: '#64748b' },
    body1: { fontSize: '1rem', fontWeight: 400 },
    body2: { fontSize: '0.875rem', fontWeight: 400 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '10px 24px',
        },
        contained: {
          '&.MuiButton-containedPrimary': {
            '&:hover': { boxShadow: '0 0 20px rgba(0,212,170,0.35)' },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#111827',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          boxShadow: 'none',
          backdropFilter: 'blur(12px)',
        },
      },
    },
  },
});
