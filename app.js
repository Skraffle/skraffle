const SUPABASE_URL = "https://knceqdyaqvabnrrhxolf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuY2VxZHlhcXZhYm5ycmh4b2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTc2NDUsImV4cCI6MjA5NjM3MzY0NX0.uvU8ij6RO9E7frRRL23u71F2kAsKdlWHf3iuptvxx18";

const sb = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");

const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const usernameInput = document.getElementById("username");
const displayNameInput = document.getElementById("display-name");

const signupBtn = document.getElementById("signup-btn");
const logoutBtn = document.getElementById("logout-btn");
const userStatus = document.getElementById("user-status");

const attackForm = document.getElementById("attack-form");
const feed = document.getElementById("feed");

const submitBtn = attackForm.querySelector("button[type='submit']");

function escapeHTML(str = "") {
    return String(str).replace(/[&<>'"]/g, tag => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
    }[tag]));
}

function isValidURL(url) {
    try {
        const u = new URL(url);
        return ["http:", "https:"].includes(u.protocol);
    } catch {
        return false;
    }
}


sb.auth.onAuthStateChange(async (_, session) => {
    if (session) {
        authSection.classList.add("hidden");
        appSection.classList.remove("hidden");
        logoutBtn.classList.remove("hidden");

        const { data } = await sb
            .from("profiles")
            .select("username, display_name")
            .eq("id", session.user.id)
            .single();

        userStatus.textContent =
            data ? `@${data.username}` : session.user.email;

        loadFeed();
    } else {
        authSection.classList.remove("hidden");
        appSection.classList.add("hidden");
        logoutBtn.classList.add("hidden");
        userStatus.textContent = "Not logged in";
    }
});

signupBtn.onclick = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const username = usernameInput.value.trim().toLowerCase();
    const display_name = displayNameInput.value.trim();

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        alert("Invalid username");
        return;
    }

    const { error } = await sb.auth.signUp({
        email,
        password,
        options: {
            data: {
                username,
                display_name
            }
        }
    });

    if (error) return alert(error.message);

    alert("Check your email to verify your account!");
};


authForm.onsubmit = async (e) => {
    e.preventDefault();

    const { error } = await sb.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value
    });

    if (error) alert(error.message);
};


logoutBtn.onclick = async () => {
    await sb.auth.signOut();
};


async function loadFeed() {
    const { data, error } = await sb
        .from("attacks")
        .select(`
            *,
            profiles(username, display_name)
        `)
        .order("created_at", { ascending: false });

    if (error) {
        feed.innerHTML = "Error loading feed";
        return;
    }

    feed.innerHTML = data.map(p => `
        <div class="attack-card">
            <h4>${escapeHTML(p.title)}</h4>

            <p>
                By <strong>${escapeHTML(p.profiles?.display_name || "Unknown")}</strong>
                (@${escapeHTML(p.profiles?.username || "unknown")})
            </p>

            <p>Points: ${p.points}</p>

            <img src="${escapeHTML(p.image_url)}">
        </div>
    `).join("");
}

attackForm.onsubmit = async (e) => {
    e.preventDefault();

    submitBtn.disabled = true;

    try {
        const title = document.getElementById("title").value.trim();
        const image_url = document.getElementById("image-url").value.trim();
        const points = parseInt(document.getElementById("points").value);

        if (!title) return alert("No title");
        if (!isValidURL(image_url)) return alert("Bad URL");

        const { data: userData } = await sb.auth.getUser();
        const user = userData.user;

        if (!user) return alert("Not logged in");

        const { error } = await sb.from("attacks").insert([{
            title,
            image_url,
            points,
            user_id: user.id
        }]);

        if (error) alert(error.message);

        attackForm.reset();
        loadFeed();

    } finally {
        submitBtn.disabled = false;
    }
};

sb.channel("attacks")
.on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "attacks"
}, loadFeed)
.subscribe();
