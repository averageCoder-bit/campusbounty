import { useEffect, useState, type FormEvent } from "react";
import { announceAuthChanged, supabase } from "../game/services/ProgressionClient";

/** Optional small React account control; mount beside the Phaser game in App.tsx. */
export function ProgressionAccount() {
    const [email, setEmail] = useState("");
    const [signedEmail, setSignedEmail] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!supabase) return;
        let mounted = true;
        void supabase.auth.getSession().then(({ data }) => {
            if (mounted) setSignedEmail(data.session?.user.email ?? null);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            setSignedEmail(session?.user.email ?? null);
            announceAuthChanged();
        });
        return () => { mounted = false; subscription.unsubscribe(); };
    }, []);

    const signIn = async (event: FormEvent) => {
        event.preventDefault();
        if (!supabase) return;
        setPending(true); setMessage("");
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim(),
            options: { emailRedirectTo: window.location.origin + window.location.pathname },
        });
        setMessage(error ? error.message : "Check your email for the CampusBounty sign-in link.");
        setPending(false);
    };
    const signOut = async () => {
        if (!supabase) return;
        setPending(true); setMessage("");
        const { error } = await supabase.auth.signOut();
        setMessage(error?.message ?? "Signed out. Guest progress stays local.");
        setPending(false);
    };

    if (!supabase) return <p>Account sign-in not configured. Playing as guest.</p>;
    return (
        <section aria-label="CampusBounty account" style={{ display: "flex", alignItems: "center",
            gap: 12, padding: "8px 12px", color: "#e2e8f0", background: "#101b2b",
            border: "1px solid #475569", borderRadius: 8, flexWrap: "wrap" }}>
            <strong>CampusBounty Account</strong>
            {signedEmail ? <>
                <span title="Academy mastery is stored on Supabase">Cloud: {signedEmail}</span>
                <button type="button" disabled={pending} onClick={() => { void signOut(); }}>Sign out</button>
            </> : <form onSubmit={event => { void signIn(event); }} style={{ display: "flex", gap: 8 }}>
                <label htmlFor="cb-account-email">Email</label>
                <input id="cb-account-email" type="email" required value={email}
                    onChange={e => setEmail(e.target.value)} placeholder="student@example.com"
                    style={{ color: "#101b2b", padding: 4 }} />
                <button type="submit" disabled={pending}>Send sign-in link</button>
            </form>}
            {message && <span role="status">{message}</span>}
        </section>
    );
}
