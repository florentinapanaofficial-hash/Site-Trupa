local st = require "util.stanza";
local service_domain = module:get_option_string("academy_service_domain");

module:hook("muc-occupant-pre-join", function(event)
    if service_domain and event.occupant.bare_jid == "focus@" .. service_domain then
        return;
    end
    if not event.origin then return true; end
    local context = event.origin and event.origin.jitsi_meet_context_user;
    if not event.origin.auth_token or not context then
        event.origin.send(st.error_reply(event.stanza, "auth", "forbidden"));
        return true;
    end
    local moderator = context.moderator == true or context.moderator == "true";
    local room, occupant = event.room, event.occupant;
    if moderator then
        room:set_affiliation(true, occupant.bare_jid, "owner");
        occupant.role = "moderator";
    else
        local affiliation = room:get_affiliation(occupant.bare_jid);
        if affiliation == "owner" or affiliation == "admin" then
            room:set_affiliation(true, occupant.bare_jid, "none");
        end
        occupant.role = "participant";
    end
end, -2);