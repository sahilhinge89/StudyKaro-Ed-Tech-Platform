import { createSlice } from "@reduxjs/toolkit";

// The JWT lives in an httpOnly cookie and is therefore not readable here.
// The slice only tracks whether the user is authenticated. The value is
// rehydrated on app start by calling the `getUserDetails` endpoint, which
// fails (and triggers a logout) when the cookie is missing or expired.
const initialState = {
  signupData: null,
  loading: false,
  token: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState: initialState,
  reducers: {
    setSignupData(state, value) {
      state.signupData = value.payload;
    },
    setLoading(state, value) {
      state.loading = value.payload;
    },
    setToken(state, value) {
      // `value` is a boolean flag: true when the user is authenticated.
      state.token = value.payload ? true : null;
    },
  },
});

export const { setSignupData, setLoading, setToken } = authSlice.actions;

export default authSlice.reducer;