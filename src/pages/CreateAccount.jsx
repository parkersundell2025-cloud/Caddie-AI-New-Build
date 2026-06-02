import { useEffect } from 'react';

export default function CreateAccount() {
  useEffect(() => {
    window.location.assign('/signin');
  }, []);
  return null;
}