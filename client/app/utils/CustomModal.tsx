"use client";

import React from "react";
import { Modal, Box } from "@mui/material";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeItem?: number;
  component: React.ComponentType<{
    setOpen: (open: boolean) => void;
    setRoute: (route: string) => void;
  }>;
  setRoute: (route: string) => void;
};

const CustomModal = ({
  open,
  setOpen,
  component: Component,
  setRoute,
}: Props) => {
  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
      sx={{ zIndex: 999999 }}
    >
      <Box className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[450px] bg-white dark:bg-slate-900 rounded-[8px] shadow p-4 outline-none">
        <Component setOpen={setOpen} setRoute={setRoute} />
      </Box>
    </Modal>
  );
};

export default CustomModal;
