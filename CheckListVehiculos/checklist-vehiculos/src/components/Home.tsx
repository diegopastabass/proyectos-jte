import React from "react";
import { User, ViewState, Vehicle } from "../types";
import VehicleList from "./VehicleList";

interface HomeProps {
  user: User;
  setViewState: (view: ViewState) => void;
  setSelectedVehicle: (vehicle: Vehicle) => void;
  addToast: (
    msg: string,
    type: "success" | "error" | "warning" | "info",
  ) => void;
}

const Home: React.FC<HomeProps> = ({
  user,
  setViewState,
  setSelectedVehicle,
  addToast,
}) => {
  // Home now just renders the VehicleList since tabs are in Navbar

  return (
    <div className="container-fluid py-4 fade-in">
      <VehicleList
        user={user}
        setViewState={setViewState}
        setSelectedVehicle={setSelectedVehicle}
        addToast={addToast}
      />
    </div>
  );
};

export default Home;
