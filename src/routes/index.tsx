import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { generateActivity } from "../api/generateActivity";
import { createPilotTokenHandler } from "../api/pilotTokens";

export const Route = createFileRoute("/")({
  component: Home,
});

const createActivity = createServerFn({ method: "POST" }).handler(async () => {
  const defaultPayload = {
    pilot_token: "SRCFRn5JawXWcUYTay26tgJf1eiQ6BwDamebk8WBPKQ",
    age_group: "3-4",
    duration_minutes: 45,
    theme: "STEM",
    group_size: 12,
    energy_level: "medium",
    curriculum_style: "Play-based",
    regenerate: false,
  };
  return generateActivity(defaultPayload);
});

const createPilotToken = createServerFn({ method: "POST" }).handler(async () => {
  const defaultPayload = {
    institution_id: "8e9397d3-2d44-4370-8281-e48de24eebd4",
  };
  return createPilotTokenHandler(defaultPayload);
});

function Home() {
  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          try {
            const response = await createActivity();
            console.log(response);
          } catch (error) {
            console.log(error);
          }
        }}
      >
        Create Activity
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            const response = await createPilotToken();
            console.log(response);
          } catch (error) {
            console.log(error);
          }
        }}
      >
        Create Pilot Token
      </button>
    </div>
  );
}
