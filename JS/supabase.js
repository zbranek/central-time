// js/supabase.js

const SUPABASE_URL = "https://rjszvvafrdtvxvftcutg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqc3p2dmFmcmR0dnh2ZnRjdXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjI4OTQsImV4cCI6MjA5MTczODg5NH0.fGpa2yJXE3Q53h_WbAbnVSlZa6gOcfo2JnEvvohrwmc";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


window.APP = {
  raceId: localStorage.getItem("rally_race_id") || ""
};