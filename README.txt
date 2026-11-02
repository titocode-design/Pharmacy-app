PHARMACY - ANDROID APP (Capacitor + SQLite)
===========================================

MUHIMU KUJUA KWANZA
-------------------
* Data za simu zinakaa kwenye simu yenyewe. Hazilingani zenyewe na za PC.
* Ukifuta (uninstall) programu, data zinapotea. Tumia kitufe cha
  "Back up data" kwenye ukurasa wa Home mara kwa mara.
* Unaweza kuweka data za PC kwenye simu: kopi faili la pharmacy.db
  (kwenye PC: %APPDATA%\Pharmacy\pharmacy.db) uliletwe kwenye simu
  (WhatsApp, Bluetooth au USB), kisha ubonyeze "Restore from backup".
* Kujenga APK kunahitaji Android Studio. Ni upakuaji mkubwa (GB kadhaa).
  Fanya kwenye Wi-Fi, si kwenye bando la simu.

MAHITAJI (kwenye PC ya Windows, mara moja tu)
---------------------------------------------
1. Node.js (unayo tayari).
2. Android Studio: https://developer.android.com/studio
   Install kwa chaguo za kawaida (Next, Next). Ifungue mara ya kwanza na
   iache ipakue SDK inayoombwa. Subiri hadi imalize.

HATUA ZA KUJENGA
----------------
1. Fungua folder hili (pharmacy-mobile) kwenye File Explorer, bonyeza
   address bar, andika  cmd  kisha Enter.
2. npm install
3. npm run android:add      (inatengeneza folder la "android")
4. npm run sync
5. npm run open            (Android Studio inafunguka na mradi)
6. Subiri chini kwenye Android Studio hadi kazi ya "Gradle" imalize
   (mara ya kwanza ni dakika 10 hadi 30 na inapakua vitu vingi).
   Ikiuliza "Update Gradle / Android Gradle Plugin", bonyeza Update.
7. Menu ya juu:  Build > Build Bundle(s) / APK(s) > Build APK(s)
8. Ikimaliza, bonyeza "locate" kwenye ujumbe wa chini kulia.
   Faili ni:  app-debug.apk
   (njia yake: android\app\build\outputs\apk\debug\app-debug.apk)

KUINSTALL KWENYE SIMU
---------------------
1. Tuma app-debug.apk kwenye simu (USB, Bluetooth, WhatsApp, Drive).
2. Ibonyeze kwenye simu. Ikiomba "Install unknown apps", ruhusu.
3. Fungua programu ya "Pharmacy".

KUBADILI KITU BAADAYE
---------------------
Hariri faili kwenye folder la  www  (mfano www\index.html), kisha
rudia hatua 4 na 7. Hatua ya 5 inahitajika tu kama Android Studio
imefungwa.


=====================================================================
NJIA YA PILI (bila Android Studio): KUJENGA KWA GITHUB (bure)
=====================================================================
Seva za GitHub zinajenga APK kwa niaba yako. Unapakia faili ndogo tu na
kupakua APK ya mwisho (MB chache).

1. Fungua akaunti ya bure: https://github.com  (Sign up)
2. Bonyeza "+" juu kulia > New repository.
   Jina: pharmacy-mobile. Chagua "Private". Bonyeza "Create repository".
3. Kwenye ukurasa unaofuata bonyeza kiungo "uploading an existing file".
   Buruta ndani vitu hivi vya folder la pharmacy-mobile:
     www (folder), scripts (folder), package.json,
     capacitor.config.json, README.txt, .gitignore
   (USIBURUTE node_modules wala android, kama vipo.)
   Subiri vimalize kupakiwa, kisha bonyeza "Commit changes".
4. Weka faili la kujenga:
   - Bonyeza "Add file" > "Create new file".
   - Kwenye kisanduku cha jina andika hasa:  .github/workflows/android.yml
     (ukiandika "/" folder zinatengenezwa zenyewe)
   - Fungua faili "android-build.yml" (kwa Notepad) kutoka folder lako,
     kopi maandishi yote, kisha ubandike kwenye kisanduku kikubwa.
   - Bonyeza "Commit changes".
5. Bonyeza kichupo cha "Actions" juu. Kazi ya "Build Android APK"
   inaanza yenyewe. Subiri dakika 5 hadi 15 hadi uone alama ya kijani.
   Ikiwa na alama nyekundu, bonyeza kazi hiyo, nakili mistari ya mwisho ya
   kosa na unitumie.
6. Bonyeza kazi hiyo yenye alama ya kijani. Chini kabisa, sehemu ya
   "Artifacts", bonyeza "pharmacy-apk" ili kuipakua (ni zip).
7. Toa (Extract) zip hiyo. Ndani utapata app-debug.apk.
8. Tuma app-debug.apk kwenye simu, ibonyeze na uruhusu
   "Install unknown apps".
