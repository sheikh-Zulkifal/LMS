"use client";

import { store } from "../redux/store";
import React, { ReactNode } from "react";
import { Provider } from "react-redux";
import { useRefreshTokenQuery } from "../redux/features/api/apiSlice";

interface ProviderProps {
  children: ReactNode;
}

function RefreshTokenLoader() {
  useRefreshTokenQuery();
  return null;
}

export function Providers({ children }: ProviderProps) {
  return (
    <Provider store={store}>
      <RefreshTokenLoader />
      {children}
    </Provider>
  );
}
