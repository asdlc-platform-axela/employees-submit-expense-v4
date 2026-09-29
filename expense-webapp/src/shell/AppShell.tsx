import type { JSX } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  AppShell as OxygenAppShell,
  ColorSchemeToggle,
  Divider,
  Footer,
  Header,
  Sidebar,
  UserMenu,
} from "@wso2/oxygen-ui";
import { LogOut, Receipt, Send, Users, FileCheck } from "@wso2/oxygen-ui-icons-react";
import { Can, useAuthz, useHeldRoles } from "../authz/gates";
import { signOut } from "../authz/session";
import { APP_NAME } from "../appName";

/** The one gated rail. Every item is wrapped in <Can>, so a caller holding two
 * roles sees the union and a caller holding one sees only that role's items —
 * exactly the pictures wireframes.dsl draws per role, superimposed. */
export function AppShell(): JSX.Element {
  const { pathname } = useLocation();
  const { username } = useAuthz();
  const roles = useHeldRoles();

  const active = pathname.startsWith("/claims/new")
    ? "submit-claim"
    : pathname.startsWith("/claims")
      ? "my-claims"
      : pathname.startsWith("/team/claims")
        ? "team-claims"
        : pathname.startsWith("/approved")
          ? "approved-claims"
          : "";

  return (
    <OxygenAppShell>
      <OxygenAppShell.Navbar>
        <Header>
          <Header.Toggle />
          <Header.Brand>
            <Header.BrandTitle>{APP_NAME}</Header.BrandTitle>
          </Header.Brand>
          <Header.Spacer />
          <Header.Actions>
            <ColorSchemeToggle />
            <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
            <UserMenu>
              <UserMenu.Trigger name={username || "Signed in"} />
              <UserMenu.Header
                name={username || "Signed in"}
                email={username}
                role={roles.join(", ") || undefined}
              />
              <UserMenu.Logout icon={<LogOut />} onClick={() => void signOut()} />
            </UserMenu>
          </Header.Actions>
        </Header>
      </OxygenAppShell.Navbar>

      <OxygenAppShell.Sidebar>
        <Sidebar activeItem={active}>
          <Sidebar.Nav>
            <Sidebar.Category>
              <Can op="GET /me/claims">
                <Sidebar.Item id="my-claims" link={<Link to="/claims" />}>
                  <Sidebar.ItemIcon>
                    <Receipt />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>My Claims</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
              <Can op="POST /me/claims">
                <Sidebar.Item id="submit-claim" link={<Link to="/claims/new" />}>
                  <Sidebar.ItemIcon>
                    <Send />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Submit Claim</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
              <Can op="GET /me/team/claims">
                <Sidebar.Item id="team-claims" link={<Link to="/team/claims" />}>
                  <Sidebar.ItemIcon>
                    <Users />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Team Claims</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
              <Can op="GET /claims">
                <Sidebar.Item id="approved-claims" link={<Link to="/approved" />}>
                  <Sidebar.ItemIcon>
                    <FileCheck />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Approved Claims</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
            </Sidebar.Category>
          </Sidebar.Nav>
        </Sidebar>
      </OxygenAppShell.Sidebar>

      <OxygenAppShell.Main>
        <Outlet />
      </OxygenAppShell.Main>

      <OxygenAppShell.Footer>
        <Footer>
          <Footer.Copyright>© WSO2 LLC</Footer.Copyright>
        </Footer>
      </OxygenAppShell.Footer>
    </OxygenAppShell>
  );
}
