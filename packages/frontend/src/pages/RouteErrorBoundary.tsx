import { useRouteError } from 'react-router-dom';
import { Container, Typography, Button, Paper, Box } from '@mui/material';

export default function RouteErrorBoundary() {
  const error = useRouteError();
  console.error('Route Error:', error);

  const errorMessage =
    (error as Error)?.message ||
    (typeof error === 'string' ? error : null) ||
    JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2) ||
    'Unknown error';

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" color="error" gutterBottom>
          Something Went Wrong
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          An unexpected error occurred while loading this page.
        </Typography>
        <Box
          component="pre"
          sx={{
            p: 2,
            bgcolor: '#1e293b',
            borderRadius: 1,
            fontSize: 12,
            textAlign: 'left',
            overflow: 'auto',
            maxHeight: 200,
            mb: 3,
            color: '#f87171',
          }}
        >
          {errorMessage}
        </Box>
        <Button variant="contained" onClick={() => window.location.href = '/'}>
          Back to Home
        </Button>
      </Paper>
    </Container>
  );
}
