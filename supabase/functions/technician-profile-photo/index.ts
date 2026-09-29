import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { requireTechnician } from "../_shared/auth.ts";

const BUCKET = "technician-profile-images";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);


/* =========================================================
   MAIN
   ========================================================= */

Deno.serve(async (request) => {

  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  try {

    if (request.method !== "POST") {
      throw new Error(
        "Only POST requests are allowed."
      );
    }

    const context =
      await requireTechnician(request);

    const contentType =
      request.headers.get("content-type") || "";

    if (
      !contentType.includes(
        "multipart/form-data"
      )
    ) {
      throw new Error(
        "Multipart form data is required."
      );
    }

    const form =
      await request.formData();

    const action =
      String(
        form.get("action") || "upload"
      );


    /* =====================================================
       REMOVE
       ===================================================== */

    if (action === "remove") {

      return await removeProfilePhoto(
        context
      );
    }


    /* =====================================================
       UPLOAD
       ===================================================== */

    if (action !== "upload") {

      throw new Error(
        "Invalid profile photo action."
      );
    }

    const file =
      form.get("file");

    if (!(file instanceof File)) {

      throw new Error(
        "Profile photo is required."
      );
    }

    return await uploadProfilePhoto(
      context,
      file
    );

  } catch (error: any) {

    console.error(
      "TECHNICIAN PROFILE PHOTO ERROR:",
      error
    );

    const message =
      error?.message === "AUTH_REQUIRED"
        ? "Sign in is required."
        : error?.message === "TECHNICIAN_REQUIRED"
        ? "An active technician account is required."
        : error?.message ||
          "Profile photo request failed.";

    const status =
      error?.message === "AUTH_REQUIRED" ||
      error?.message === "TECHNICIAN_REQUIRED"
        ? 401
        : 400;

    return corsResponse(
      {
        error: message
      },
      status
    );
  }
});


/* =========================================================
   UPLOAD / REPLACE PROFILE PHOTO
   ========================================================= */

async function uploadProfilePhoto(
  context: any,
  file: File
) {

  const {
    supabase: db,
    technician,
    user
  } = context;


  /* -------------------------------------------------------
     Validate technician
     ------------------------------------------------------- */

  if (!technician?.id) {

    throw new Error(
      "Technician account could not be identified."
    );
  }


  /* -------------------------------------------------------
     Authenticated Supabase user ID
     ------------------------------------------------------- */

  if (!user?.id) {

    throw new Error(
      "Authenticated user could not be identified."
    );
  }


  /* -------------------------------------------------------
     Validate file type
     ------------------------------------------------------- */

  if (
    !ALLOWED_TYPES.has(
      file.type
    )
  ) {

    throw new Error(
      "Only JPG, PNG or WebP images are allowed."
    );
  }


  /* -------------------------------------------------------
     Validate file size
     ------------------------------------------------------- */

  if (file.size <= 0) {

    throw new Error(
      "The selected image is empty."
    );
  }

  if (file.size > MAX_FILE_SIZE) {

    throw new Error(
      "Profile photo must be 5 MB or smaller."
    );
  }


  /*
   * IMPORTANT
   *
   * The frontend cropper will send the final
   * cropped image as WebP.
   *
   * Until then, the backend accepts JPG/PNG/WebP
   * for validation compatibility.
   */

  const fileBytes =
    new Uint8Array(
      await file.arrayBuffer()
    );


  /* -------------------------------------------------------
     Fixed private storage path
     ------------------------------------------------------- */

  const storagePath =
    `technicians/${user.id}/profile.webp`;


  /* -------------------------------------------------------
     Upload / replace
     ------------------------------------------------------- */

  const {
    error: uploadError
  } = await db.storage
    .from(BUCKET)
    .upload(
      storagePath,
      fileBytes,
      {
        contentType:
          "image/webp",

        cacheControl:
          "3600",

        upsert:
          true
      }
    );


  if (uploadError) {

    console.error(
      "PROFILE IMAGE UPLOAD ERROR:",
      uploadError
    );

    throw new Error(
      "Profile photo upload failed."
    );
  }


  /* -------------------------------------------------------
     Update technician database record
     ------------------------------------------------------- */

  const {
    error: updateError
  } = await db
    .from("technicians")
    .update({
      profile_image_path:
        storagePath,

      updated_at:
        new Date().toISOString()
    })
    .eq(
      "id",
      technician.id
    )
    .eq(
      "auth_user_id",
      user.id
    );


  if (updateError) {

    console.error(
      "PROFILE IMAGE DB UPDATE ERROR:",
      updateError
    );


    /*
     * Cleanup uploaded file if DB update failed.
     */

    await db.storage
      .from(BUCKET)
      .remove([
        storagePath
      ]);


    throw new Error(
      "Profile photo could not be saved."
    );
  }


  /* -------------------------------------------------------
     Create signed URL
     ------------------------------------------------------- */

  const {
    data: signed,
    error: signedError
  } = await db.storage
    .from(BUCKET)
    .createSignedUrl(
      storagePath,
      60 * 60
    );


  if (
    signedError ||
    !signed?.signedUrl
  ) {

    console.error(
      "PROFILE IMAGE SIGNED URL ERROR:",
      signedError
    );

    throw new Error(
      "Profile photo was uploaded, but the image URL could not be generated."
    );
  }


  return corsResponse({

    success:
      true,

    profile_image_path:
      storagePath,

    profile_image_url:
      signed.signedUrl

  });
}


/* =========================================================
   REMOVE PROFILE PHOTO
   ========================================================= */

async function removeProfilePhoto(
  context: any
) {

  const {
    supabase: db,
    technician,
    user
  } = context;


  if (
    !technician?.id ||
    !user?.id
  ) {

    throw new Error(
      "Technician account could not be identified."
    );
  }


  /* -------------------------------------------------------
     Fixed storage path
     ------------------------------------------------------- */

  const storagePath =
    `technicians/${user.id}/profile.webp`;


  /* -------------------------------------------------------
     Remove Storage file
     ------------------------------------------------------- */

  const {
    error: removeError
  } = await db.storage
    .from(BUCKET)
    .remove([
      storagePath
    ]);


  if (removeError) {

    console.error(
      "PROFILE IMAGE REMOVE ERROR:",
      removeError
    );

    throw new Error(
      "Profile photo could not be removed."
    );
  }


  /* -------------------------------------------------------
     Clear database path
     ------------------------------------------------------- */

  const {
    error: updateError
  } = await db
    .from("technicians")
    .update({

      profile_image_path:
        null,

      updated_at:
        new Date().toISOString()

    })
    .eq(
      "id",
      technician.id
    )
    .eq(
      "auth_user_id",
      user.id
    );


  if (updateError) {

    console.error(
      "PROFILE IMAGE PATH CLEAR ERROR:",
      updateError
    );

    throw new Error(
      "Profile photo was removed, but the profile could not be updated."
    );
  }


  return corsResponse({

    success:
      true,

    profile_image_path:
      null,

    profile_image_url:
      null

  });
}