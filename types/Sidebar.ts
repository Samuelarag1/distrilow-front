// import { IconType } from "react-icons";

import { LucideProps } from "lucide-react";
import { ForwardRefExoticComponent } from "react";
import { RefAttributes } from "react";

export interface ISidebarMenu {
  title: string;
  url: string;
  icon: ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> | RefAttributes<SVGSVGElement>
  >;
}
