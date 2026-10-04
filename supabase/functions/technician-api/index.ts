import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { requireTechnician } from "../_shared/auth.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  try {
    const context = await requireTechnician(request);

    const body = await request.json();

    const result = await route(
      context,
      body
    );

    return corsResponse(result);

  } catch (error: any) {

    const message =
      error?.message === "AUTH_REQUIRED"
        ? "Sign in is required."
        : error?.message === "TECHNICIAN_REQUIRED"
        ? "An active technician account is required."
        : error?.message || "Request failed.";

    return corsResponse(
      {
        error: message
      },
      message.includes("required")
        ? 401
        : 400
    );
  }
});


/* =========================================================
   ROUTER
   ========================================================= */

async function route(
  context: any,
  body: any
) {

  const {
    supabase: db,
    technician
  } = context;

  switch (body.action) {

    /* =====================================================
       DASHBOARD
       ===================================================== */

    case "dashboard":
      return dashboard(
        db,
        technician
      );


    /* =====================================================
       APPOINTMENT DETAILS
       ===================================================== */

    case "appointment":
      return appointment(
        db,
        technician.id,
        body.id
      );


    /* =====================================================
       STATUS UPDATE
       ===================================================== */

    case "set_status":
      return setStatus(
        db,
        technician.id,
        body
      );

      case "support_bot":
  return supportBot(
    db,
    technician.id,
    body
  );

case "support_bot_message":
  return supportBotMessage(
    db,
    technician.id,
    body
  );

    /* =====================================================
       COMPLETION OTP
       ===================================================== */

    case "start_completion":
      return startCompletion(
        db,
        technician,
        body.id
      );


    case "verify_completion":
      return verifyCompletion(
        db,
        technician,
        body.id,
        body.otp
      );


    /* =====================================================
       TECHNICIAN PROFILE
       ===================================================== */

    case "profile":
      return profile(
        db,
        technician.id
      );


    /* =====================================================
       TECHNICIAN HISTORY
       ===================================================== */

    case "history":
      return history(
        db,
        technician.id
      );


        /* =====================================================
       SUPPORT CENTER
       ===================================================== */

    case "support":
      return support();


    /* =====================================================
       SUPPORT JOBS
       ===================================================== */

    case "support_jobs":
      return supportJobs(
        db,
        technician.id
      );


        /* =====================================================
       CREATE SUPPORT REQUEST
       ===================================================== */

    case "support_create":
      return createSupportRequest(
        db,
        technician.id,
        body
      );


    case "support_my_requests":
      return supportMyRequests(
        db,
        technician.id
      );

    case "support_get_request":
     return supportGetRequest(
    db,
    technician.id,
    body
  );

  case "support_messages":
  return supportMessages(
    db,
    technician.id,
    body
  );

case "support_message_send":
  return sendSupportMessage(
    db,
    technician.id,
    body
  );

    default:
      throw new Error(
        "Unknown technician action."
      );
  }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

async function dashboard(
  db: any,
  technician: any
) {

  const today =
    new Date().toLocaleDateString(
      "en-CA"
    );

  const {
    data,
    error
  } = await db
    .from("appointments")
    .select(
      "id,appointment_id,customer_name,mobile,service_category,service_type,appointment_date,appointment_time,service_address,problem_description,status,google_maps_url,job_code"
    )
    .eq(
      "technician_id",
      technician.id
    )
    .order(
      "appointment_date"
    )
    .order(
      "appointment_time"
    );

  if (error) {
    throw error;
  }

  const jobs = data || [];

  return {

    technician: {
      name:
        technician.full_name,

      technician_code:
        technician.technician_code
    },

    today:
      jobs.filter(
        (job: any) =>
          job.appointment_date === today &&
          job.status !== "completed"
      ),

    upcoming:
      jobs.filter(
        (job: any) =>
          job.appointment_date > today &&
          job.status !== "completed"
      ),

    completed:
      jobs.filter(
        (job: any) =>
          job.status === "completed"
      )
  };
}


/* =========================================================
   APPOINTMENT DETAILS
   ========================================================= */

async function appointment(
  db: any,
  technicianId: string,
  id: string
) {

  if (
    !isUuid(id)
  ) {
    throw new Error(
      "Invalid appointment."
    );
  }

  const {
    data,
    error
  } = await db
    .from("appointments")
    .select(
      "id,appointment_id,customer_name,mobile,email,service_category,service_type,problem_description,photo_references,service_location_type,service_address,landmark,latitude,longitude,google_maps_url,appointment_date,appointment_time,status,job_code,appointment_status_history(old_status,new_status,changed_at,note)"
    )
    .eq(
      "id",
      id
    )
    .eq(
      "technician_id",
      technicianId
    )
    .single();

  if (
    error ||
    !data
  ) {
    throw new Error(
      "Assigned appointment not found."
    );
  }

  return {
    appointment: data
  };
}


/* =========================================================
   TECHNICIAN PROFILE
   ========================================================= */

async function profile(
  db: any,
  technicianId: string
) {

  if (!isUuid(technicianId)) {
    throw new Error(
      "Invalid technician."
    );
  }

  const {
    data,
    error
  } = await db
    .from("technicians")
    .select(`
      id,
      auth_user_id,
      technician_code,
      full_name,
      mobile,
      username,
      specialization,
      working_days,
      working_start,
      working_end,
      is_active,
      created_at,
      updated_at,
      profile_image_path
    `)
    .eq(
      "id",
      technicianId
    )
    .maybeSingle();


  if (error) {

    console.error(
      "TECHNICIAN PROFILE QUERY ERROR:",
      error.message
    );

    throw new Error(
      "PROFILE_QUERY_FAILED: " +
      error.message
    );
  }


  if (!data) {

    console.error(
      "TECHNICIAN PROFILE DATA EMPTY:",
      technicianId
    );

    throw new Error(
      "PROFILE_DATA_EMPTY"
    );
  }


  /* =======================================================
     AUTH EMAIL
     ======================================================= */

  let email: string | null = null;

  if (data.auth_user_id) {

    const {
      data: authData,
      error: authError
    } =
      await db.auth.admin.getUserById(
        data.auth_user_id
      );

    if (
      !authError &&
      authData?.user
    ) {

      email =
        authData.user.email ||
        null;
    }
  }


  /* =======================================================
     PROFILE IMAGE SIGNED URL
     ======================================================= */

  let profileImageUrl:
    string | null = null;


  if (
    data.profile_image_path
  ) {

    const {
      data: signedData,
      error: signedError
    } =
      await db.storage
        .from(
          "technician-profile-images"
        )
        .createSignedUrl(
          data.profile_image_path,
          60 * 60
        );


    if (signedError) {

      console.error(
        "PROFILE IMAGE SIGNED URL ERROR:",
        signedError.message
      );

    } else {

      profileImageUrl =
        signedData?.signedUrl ||
        null;
    }
  }


  /* =======================================================
     RESPONSE
     ======================================================= */

  return {

    profile: {

      id:
        data.id,

      technician_code:
        data.technician_code,

      full_name:
        data.full_name,

      mobile:
        data.mobile,

      username:
        data.username,

      email,

      specialization:
        Array.isArray(
          data.specialization
        )
          ? data.specialization
          : [],

      working_days:
        Array.isArray(
          data.working_days
        )
          ? data.working_days
          : [],

      working_start:
        data.working_start,

      working_end:
        data.working_end,

      is_active:
        data.is_active,

      created_at:
        data.created_at,

      updated_at:
        data.updated_at,

      profile_image_path:
        data.profile_image_path ||
        null,

      profile_image_url:
        profileImageUrl

    }

  };
}


/* =========================================================
   TECHNICIAN HISTORY
   ========================================================= */

async function history(
  db: any,
  technicianId: string
) {

  if (
    !isUuid(technicianId)
  ) {
    throw new Error(
      "Invalid technician."
    );
  }

  const {
    data,
    error
  } = await db
    .from("appointments")
    .select(
      "id,appointment_id,customer_name,mobile,email,service_category,service_type,problem_description,service_location_type,service_address,landmark,appointment_date,appointment_time,status,job_code,google_maps_url"
    )
    .eq(
      "technician_id",
      technicianId
    )
    .eq(
      "status",
      "completed"
    )
    .order(
      "appointment_date",
      {
        ascending: false
      }
    )
    .order(
      "appointment_time",
      {
        ascending: false
      }
    );

  if (error) {
    throw error;
  }

  return {
    history:
      data || []
  };
}


/* =========================================================
   SUPPORT
   ========================================================= */

function support() {

  return {

    support: {

      company: {
        name:
          "Click & Fix Technologies"
      },

      contact: {

        phone:
          "7098889990",

        email:
          "info.clicknfixtech@gmail.com"
      },

      channels: {

        phone:
          "tel:+917098889990",

        whatsapp:
          "https://wa.me/917098889990",

        email:
          "mailto:info.clicknfixtech@gmail.com"
      }

    }

  };
}

/* =========================================================
   SUPPORT JOBS
   PHASE 3A
   RETURN ONLY THIS TECHNICIAN'S ASSIGNED JOBS
   ========================================================= */

async function supportJobs(
  db: any,
  technicianId: string
) {

  if (
    !isUuid(technicianId)
  ) {
    throw new Error(
      "Invalid technician."
    );
  }


  const {
    data,
    error
  } = await db
    .from("appointments")
    .select(`
      id,
      appointment_id,
      appointment_code,
      appointment_date,
      appointment_time,
      customer_name,
      mobile,
      service_category,
      service_type,
      service_address,
      problem_description,
      status,
      job_code,
      google_maps_url
    `)
    .eq(
      "technician_id",
      technicianId
    )
    .not(
      "status",
      "in",
      "(completed,cancelled,no_show)"
    )
    .order(
      "appointment_date",
      {
        ascending: true
      }
    )
    .order(
      "appointment_time",
      {
        ascending: true
      }
    );


  if (error) {

    console.error(
      "SUPPORT JOBS QUERY ERROR:",
      error.message
    );

    throw new Error(
      "SUPPORT_JOBS_QUERY_FAILED"
    );
  }


  return {

    jobs:
      (data || []).map(
        (job: any) => ({

          id:
            job.id,

          appointment_id:
            job.appointment_id,

          appointment_code:
            job.appointment_code,

          appointment_date:
            job.appointment_date,

          appointment_time:
            job.appointment_time,

          customer_name:
            job.customer_name,

          mobile:
            job.mobile,

          service_category:
            job.service_category,

          service_type:
            job.service_type,

          service_address:
            job.service_address,

          problem_description:
            job.problem_description,

          status:
            job.status,

          job_code:
            job.job_code,

          google_maps_url:
            job.google_maps_url

        })
      )

  };
}


/* =========================================================
   CREATE SUPPORT REQUEST
   PHASE 3A
   ========================================================= */

async function createSupportRequest(
  db: any,
  technicianId: string,
  body: any
) {

  if (
    !isUuid(technicianId)
  ) {
    throw new Error(
      "Invalid technician."
    );
  }


  /* =======================================================
     INPUT VALIDATION
     ======================================================= */

  const appointmentId =
    typeof body.appointment_id === "string"
      ? body.appointment_id.trim()
      : "";


  if (
    !isUuid(appointmentId)
  ) {
    throw new Error(
      "Invalid appointment."
    );
  }


  const supportType =
    typeof body.support_type === "string"
      ? body.support_type.trim()
      : "";


  const allowedSupportTypes = [
    "TECHNICAL_PROBLEM",
    "APPOINTMENT_JOB",
    "CCTV_PROBLEM",
    "COMPUTER_LAPTOP",
    "JOB_ID_BILLING",
    "TECHNICIAN_SUPPORT",
    "OTHER"
  ];


  if (
    !allowedSupportTypes.includes(
      supportType
    )
  ) {
    throw new Error(
      "Invalid support type."
    );
  }


  const problemDetails =
    text(
      body.problem_details,
      2000
    );


  if (
    !problemDetails ||
    problemDetails.length < 10
  ) {
    throw new Error(
      "Please provide at least 10 characters describing the problem."
    );
  }


  /* =======================================================
     GPS VALIDATION
     ======================================================= */

  const latitude =
    Number(
      body.latitude
    );


  const longitude =
    Number(
      body.longitude
    );


  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      "Current location is required."
    );
  }


  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      "Invalid location coordinates."
    );
  }


  /* =======================================================
     VERIFY ASSIGNED APPOINTMENT
     ======================================================= */

  const {
    data: appointment,
    error: appointmentError
  } = await db
    .from("appointments")
    .select(`
      id,
      appointment_id,
      appointment_code,
      customer_name,
      mobile,
      service_category,
      service_type,
      service_address,
      status,
      technician_id
    `)
    .eq(
      "id",
      appointmentId
    )
    .eq(
      "technician_id",
      technicianId
    )
    .maybeSingle();


  if (
    appointmentError
  ) {

    console.error(
      "SUPPORT APPOINTMENT QUERY ERROR:",
      appointmentError.message
    );

    throw new Error(
      "Could not verify the assigned appointment."
    );
  }


  if (
    !appointment
  ) {
    throw new Error(
      "Assigned appointment not found."
    );
  }


  /* =======================================================
     PREVENT SUPPORT REQUEST ON CLOSED JOB
     ======================================================= */

  if (
    [
      "completed",
      "cancelled",
      "no_show"
    ].includes(
      appointment.status
    )
  ) {

    throw new Error(
      "Support cannot be raised for this appointment."
    );
  }


  /* =======================================================
     GOOGLE MAPS LOCATION URL
     SERVER GENERATES THIS
     ======================================================= */

  const locationUrl =
    `https://www.google.com/maps?q=${latitude},${longitude}`;


  /* =======================================================
     SUPPORT TOKEN
     ======================================================= */

  let supportToken = null;

  let tokenAttempts = 0;

  while (
    !supportToken &&
    tokenAttempts < 10
  ) {

    tokenAttempts++;

    const candidate =
      generateSupportToken();


    const {
      data: existing,
      error: tokenCheckError
    } = await db
      .from("support_requests")
      .select("id")
      .eq(
        "support_token",
        candidate
      )
      .maybeSingle();


    if (
      tokenCheckError
    ) {

      console.error(
        "SUPPORT TOKEN CHECK ERROR:",
        tokenCheckError.message
      );

      throw new Error(
        "Could not generate support token."
      );
    }


    if (!existing) {

      supportToken =
        candidate;

    }

  }


  if (
    !supportToken
  ) {
    throw new Error(
      "Could not generate a unique support token."
    );
  }


  /* =======================================================
     CREATE SUPPORT REQUEST
     ======================================================= */

    const {
    data: created,
    error: insertError
  } = await db
    .from("support_requests")
    .insert({

      support_token:
        supportToken,

      appointment_id:
        appointment.id,

      technician_id:
        technicianId,

      support_type:
        supportType,

      problem_details:
        problemDetails,

      latitude:
        latitude,

      longitude:
        longitude,

      location_url:
        locationUrl,

      location_captured_at:
        new Date().toISOString(),

      status:
        "OPEN"

    })
    .select(`
      id,
      support_token,
      appointment_id,
      technician_id,
      support_type,
      problem_details,
      latitude,
      longitude,
      location_url,
      location_captured_at,
      status,
      created_at,
      updated_at
    `)
    .single();


   if (
    insertError
  ) {

    console.error(
      "SUPPORT REQUEST INSERT ERROR:",
      {
        message:
          insertError.message,

        details:
          insertError.details,

        hint:
          insertError.hint,

        code:
          insertError.code
      }
    );

    throw new Error(
      `SUPPORT_REQUEST_CREATE_FAILED: ${insertError.message}`
    );
  }


  /* =======================================================
     RESPONSE
     ======================================================= */

  return {

    support: {

      id:
        created.id,

      support_token:
        created.support_token,

      appointment_id:
        created.appointment_id,

      technician_id:
        created.technician_id,

      support_type:
        created.support_type,

      problem_details:
        created.problem_details,

      latitude:
        created.latitude,

      longitude:
        created.longitude,

      location_url:
        created.location_url,

      location_captured_at:
        created.location_captured_at,

      status:
        created.status,

      created_at:
        created.created_at,

      updated_at:
        created.updated_at

    },

    appointment: {

      id:
        appointment.id,

      appointment_id:
        appointment.appointment_id,

      appointment_code:
        appointment.appointment_code,

      customer_name:
        appointment.customer_name,

      mobile:
        appointment.mobile,

      service_category:
        appointment.service_category,

      service_type:
        appointment.service_type,

      service_address:
        appointment.service_address

    }

  };
}

/* =========================================================
   MY SUPPORT REQUESTS
   PHASE 4A / 4B
   RETURN ONLY THIS TECHNICIAN'S SUPPORT REQUESTS
   WITH APPOINTMENT REFERENCE
   ========================================================= */

async function supportMyRequests(
  db: any,
  technicianId: string
) {

  if (
    !isUuid(technicianId)
  ) {

    throw new Error(
      "Invalid technician."
    );

  }


  const {
    data,
    error
  } = await db
    .from("support_requests")
    .select(`
      id,
      support_token,
      appointment_id,
      technician_id,
      support_type,
      problem_details,
      latitude,
      longitude,
      location_url,
      location_captured_at,
      status,
      created_at,
      updated_at,
      acknowledged_at,
      resolved_at,
      closed_at,

      appointments (
        appointment_id,
        appointment_code,
        appointment_date,
        appointment_time,
        customer_name,
        service_category
      )
    `)
    .eq(
      "technician_id",
      technicianId
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    console.error(
      "MY SUPPORT REQUESTS QUERY ERROR:",
      {
        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,

        code:
          error.code
      }
    );


    throw new Error(
      "SUPPORT_REQUESTS_QUERY_FAILED"
    );

  }


  const requests =
    data || [];

      /* =====================================================
     UNREAD ADMIN MESSAGES
     COUNT ONLY MESSAGES NOT YET READ BY TECHNICIAN
     ===================================================== */

  const requestIds =
    requests.map(
      (request: any) => request.id
    );

  const unreadCounts =
    new Map<string, number>();

  if (requestIds.length > 0) {

    const {
      data: unreadMessages,
      error: unreadError
    } = await db
      .from("support_messages")
      .select("support_request_id")
      .in(
        "support_request_id",
        requestIds
      )
      .eq(
        "sender_type",
        "ADMIN"
      )
      .is(
        "read_at_technician",
        null
      );

    if (unreadError) {

      console.error(
        "SUPPORT UNREAD COUNT ERROR:",
        unreadError.message
      );

      throw new Error(
        "SUPPORT_UNREAD_COUNT_FAILED"
      );
    }

    for (const message of unreadMessages || []) {

      const requestId =
        message.support_request_id;

      unreadCounts.set(
        requestId,
        (unreadCounts.get(requestId) || 0) + 1
      );
    }
  }

  const totalUnreadCount =
    Array.from(
      unreadCounts.values()
    ).reduce(
      (total, count) => total + count,
      0
    );

    return {

    total_unread_count:
      totalUnreadCount,

    requests:
      requests.map(
        (request: any) => {

          const appointment =
            Array.isArray(
              request.appointments
            )
              ? (
                  request.appointments[0] ||
                  null
                )
              : request.appointments;


          return {

            id:
              request.id,
                          unread_count:
              unreadCounts.get(request.id) || 0,

            support_token:
              request.support_token,

            appointment_id:
              request.appointment_id,

            appointment_reference:
              appointment?.appointment_id ||
              appointment?.appointment_code ||
              null,

            appointment_code:
              appointment?.appointment_code ||
              null,

            appointment_date:
              appointment?.appointment_date ||
              null,

            appointment_time:
              appointment?.appointment_time ||
              null,

            customer_name:
              appointment?.customer_name ||
              null,

            service_category:
              appointment?.service_category ||
              null,

            technician_id:
              request.technician_id,

            support_type:
              request.support_type,

            problem_details:
              request.problem_details,

            latitude:
              request.latitude,

            longitude:
              request.longitude,

            location_url:
              request.location_url,

            location_captured_at:
              request.location_captured_at,

            status:
              request.status,

            created_at:
              request.created_at,

            updated_at:
              request.updated_at,

            acknowledged_at:
              request.acknowledged_at,

            resolved_at:
              request.resolved_at,

            closed_at:
              request.closed_at

          };

        }
      )

  };

}

/* =========================================================
   GET SUPPORT REQUEST DETAIL
   PHASE 4C
   ========================================================= */

async function supportGetRequest(
  db: any,
  technicianId: string,
  body: any
) {

  if (
    !isUuid(technicianId)
  ) {

    throw new Error(
      "Invalid technician."
    );

  }


  const requestId =
    String(
      body?.request_id ||
      ""
    ).trim();


  if (
    !requestId ||
    !isUuid(requestId)
  ) {

    throw new Error(
      "Invalid support request."
    );

  }


  const {
    data,
    error
  } = await db
    .from("support_requests")
    .select(`
      id,
      support_token,
      appointment_id,
      technician_id,
      support_type,
      problem_details,
      latitude,
      longitude,
      location_url,
      location_captured_at,
      status,
      created_at,
      updated_at,
      acknowledged_at,
      resolved_at,
      closed_at,

      appointments (
        appointment_id,
        appointment_code,
        appointment_date,
        appointment_time,
        customer_name,
        mobile,
        service_category,
        service_type,
        service_address,
        problem_description,
        status,
        job_code,
        google_maps_url
      )
    `)
    .eq(
      "id",
      requestId
    )
    .eq(
      "technician_id",
      technicianId
    )
    .maybeSingle();


  if (error) {

    console.error(
      "SUPPORT REQUEST DETAIL QUERY ERROR:",
      {
        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,

        code:
          error.code
      }
    );


    throw new Error(
      "SUPPORT_REQUEST_DETAIL_QUERY_FAILED"
    );

  }


  if (!data) {

    throw new Error(
      "SUPPORT_REQUEST_NOT_FOUND"
    );

  }


  const appointment =
    Array.isArray(
      data.appointments
    )
      ? (
          data.appointments[0] ||
          null
        )
      : data.appointments;


  return {

    request: {

      id:
        data.id,

      support_token:
        data.support_token,

      appointment_id:
        data.appointment_id,

      appointment_reference:
        appointment?.appointment_id ||
        appointment?.appointment_code ||
        null,

      appointment_code:
        appointment?.appointment_code ||
        null,

      appointment_date:
        appointment?.appointment_date ||
        null,

      appointment_time:
        appointment?.appointment_time ||
        null,

      customer_name:
        appointment?.customer_name ||
        null,

      mobile:
        appointment?.mobile ||
        null,

      service_category:
        appointment?.service_category ||
        null,

      service_type:
        appointment?.service_type ||
        null,

      service_address:
        appointment?.service_address ||
        null,

      job_code:
        appointment?.job_code ||
        null,

      support_type:
        data.support_type,

      problem_details:
        data.problem_details,

      latitude:
        data.latitude,

      longitude:
        data.longitude,

      location_url:
        data.location_url,

      location_captured_at:
        data.location_captured_at,

      status:
        data.status,

      created_at:
        data.created_at,

      updated_at:
        data.updated_at,

      acknowledged_at:
        data.acknowledged_at,

      resolved_at:
        data.resolved_at,

      closed_at:
        data.closed_at

    }

  };

}

/* =========================================================
   SUPPORT CHAT
   LOAD MESSAGES
   PHASE 5A
   ========================================================= */

async function supportMessages(
  db: any,
  technicianId: string,
  body: any
) {

  if (
    !isUuid(technicianId)
  ) {

    throw new Error(
      "Invalid technician."
    );

  }


  const requestId =
    String(
      body?.support_request_id ||
      ""
    ).trim();


  if (
    !requestId ||
    !isUuid(requestId)
  ) {

    throw new Error(
      "Invalid support request."
    );

  }


  /*
   * Verify that this support request
   * belongs to the logged-in technician.
   */

  const {
    data: supportRequest,
    error: supportRequestError
  } = await db
    .from("support_requests")
    .select(`
      id,
      support_token,
      technician_id,
      status
    `)
    .eq(
      "id",
      requestId
    )
    .eq(
      "technician_id",
      technicianId
    )
    .maybeSingle();


  if (
    supportRequestError
  ) {

    console.error(
      "SUPPORT MESSAGE REQUEST VERIFY ERROR:",
      {
        message:
          supportRequestError.message,

        details:
          supportRequestError.details,

        hint:
          supportRequestError.hint,

        code:
          supportRequestError.code
      }
    );


    throw new Error(
      "SUPPORT_REQUEST_VERIFY_FAILED"
    );

  }


  
  if (!supportRequest) {

    throw new Error(
      "SUPPORT_REQUEST_NOT_FOUND"
    );

  }


  /* =====================================================
     MARK ADMIN MESSAGES AS READ BY TECHNICIAN
     MY CODE STARTS HERE
     ===================================================== */

  const { error: readError } = await db
    .from("support_messages")
    .update({
      read_at_technician: new Date().toISOString()
    })
    .eq("support_request_id", requestId)
    .eq("sender_type", "ADMIN")
    .is("read_at_technician", null);

  if (readError) {
    console.error(
      "TECHNICIAN MARK READ ERROR:",
      readError.message
    );

    throw new Error("MESSAGES_MARK_READ_FAILED");
  }

  /* MY CODE ENDS HERE */


  /*
   * Load messages.
   */

  const {
    data,
    error
  } = await db
    .from("support_messages")
    .select(`
      id,
      support_request_id,
      sender_type,
      sender_user_id,
      message,
      created_at
    `)
    .eq(
      "support_request_id",
      requestId
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );


  if (error) {

    console.error(
      "SUPPORT MESSAGES QUERY ERROR:",
      {
        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,

        code:
          error.code
      }
    );


    throw new Error(
      "SUPPORT_MESSAGES_QUERY_FAILED"
    );

  }


  return {

    support_request: {

      id:
        supportRequest.id,

      support_token:
        supportRequest.support_token,

      status:
        supportRequest.status

    },

    messages:
      data || []

  };

}

/* =========================================================
   SUPPORT CHAT
   SEND MESSAGE
   PHASE 5A
   ========================================================= */

async function sendSupportMessage(
  db: any,
  technicianId: string,
  body: any
) {

  if (
    !isUuid(technicianId)
  ) {

    throw new Error(
      "Invalid technician."
    );

  }


  const requestId =
    String(
      body?.support_request_id ||
      ""
    ).trim();


  const message =
    String(
      body?.message ||
      ""
    ).trim();


  if (
    !requestId ||
    !isUuid(requestId)
  ) {

    throw new Error(
      "Invalid support request."
    );

  }


  if (!message) {

    throw new Error(
      "Message is required."
    );

  }


  if (
    message.length > 2000
  ) {

    throw new Error(
      "Message cannot exceed 2000 characters."
    );

  }


  /*
   * Verify ownership.
   */

  const {
    data: supportRequest,
    error: supportRequestError
  } = await db
    .from("support_requests")
    .select(`
      id,
      support_token,
      technician_id,
      status
    `)
    .eq(
      "id",
      requestId
    )
    .eq(
      "technician_id",
      technicianId
    )
    .maybeSingle();


  if (
    supportRequestError
  ) {

    console.error(
      "SEND MESSAGE REQUEST VERIFY ERROR:",
      {
        message:
          supportRequestError.message,

        details:
          supportRequestError.details,

        hint:
          supportRequestError.hint,

        code:
          supportRequestError.code
      }
    );


    throw new Error(
      "SUPPORT_REQUEST_VERIFY_FAILED"
    );

  }


  if (!supportRequest) {

    throw new Error(
      "SUPPORT_REQUEST_NOT_FOUND"
    );

  }


  /*
   * Technician cannot send messages
   * to closed/cancelled requests.
   */

  const currentStatus =
    String(
      supportRequest.status ||
      ""
    ).toUpperCase();


  if (
    currentStatus === "CLOSED" ||
    currentStatus === "CANCELLED"
  ) {

    throw new Error(
      "SUPPORT_REQUEST_CLOSED"
    );

  }


  /*
   * Insert message.
   *
   * IMPORTANT:
   * sender_type is NEVER accepted from frontend.
   *
   * It is always forced to TECHNICIAN.
   */

  const {
    data,
    error
  } = await db
    .from("support_messages")
    .insert({

      support_request_id:
        requestId,

      sender_type:
        "TECHNICIAN",

      sender_user_id:
        technicianId,

      message:
        message

    })
    .select(`
      id,
      support_request_id,
      sender_type,
      sender_user_id,
      message,
      created_at
    `)
    .single();


  if (error) {

    console.error(
      "SUPPORT MESSAGE INSERT ERROR:",
      {
        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,

        code:
          error.code
      }
    );


    throw new Error(
      "SUPPORT_MESSAGE_SEND_FAILED"
    );

  }


  return {

    message:
      data

  };

}

/* =========================================================
   SUPPORT BOT
   PHASE 5
   RULE-BASED SUPPORT TROUBLESHOOTING
   ========================================================= */

async function supportBot(
  db: any,
  technicianId: string,
  body: any
) {

  if (
    !isUuid(technicianId)
  ) {
    throw new Error(
      "Invalid technician."
    );
  }


  const requestId =
    String(
      body?.support_request_id ||
      ""
    ).trim();


  /*
   * support_request_id is optional when
   * the bot is being opened before a
   * support request exists.
   */

  if (
    requestId &&
    !isUuid(requestId)
  ) {
    throw new Error(
      "Invalid support request."
    );
  }


  const action =
  String(
    body?.bot_action ||
    "START"
  )
    .trim()
    .toUpperCase();


  const category =
    String(
      body?.category ||
      ""
    )
      .trim()
      .toUpperCase();


  const subcategory =
    String(
      body?.subcategory ||
      ""
    )
      .trim()
      .toUpperCase();


  /*
   * If a support request is supplied,
   * verify that it belongs to the
   * logged-in technician.
   */

  if (requestId) {

    const {
      data: supportRequest,
      error: supportRequestError
    } = await db
      .from("support_requests")
      .select(`
        id,
        support_token,
        technician_id,
        status
      `)
      .eq(
        "id",
        requestId
      )
      .eq(
        "technician_id",
        technicianId
      )
      .maybeSingle();


    if (
      supportRequestError
    ) {

      console.error(
        "SUPPORT BOT REQUEST VERIFY ERROR:",
        supportRequestError.message
      );

      throw new Error(
        "SUPPORT_REQUEST_VERIFY_FAILED"
      );
    }


    if (
      !supportRequest
    ) {

      throw new Error(
        "SUPPORT_REQUEST_NOT_FOUND"
      );
    }
  }


  /*
   * Rule-based response.
   */

  const response =
    getSupportBotResponse(
      action,
      category,
      subcategory
    );


  return {

    bot: {

      action:
        action,

      category:
        category || null,

      subcategory:
        subcategory || null,

      message:
        response.message,

      options:
        response.options || [],

      next_action:
        response.next_action || null

    }

  };

}


/* =========================================================
   SUPPORT BOT RESPONSE ENGINE
   ========================================================= */

function getSupportBotResponse(
  action: string,
  category: string,
  subcategory: string
) {


  /* =====================================================
     START
     ===================================================== */

  if (
    action === "START"
  ) {

    return {

      message:
        "Hello! I’m the Click & Fix Support Bot. Please select the type of problem you need help with.",

      options: [

        {
          id:
            "TECHNICAL_PROBLEM",

          label:
            "Technical Problem"
        },

        {
          id:
            "APPOINTMENT_JOB",

          label:
            "Appointment / Job"
        },

        {
          id:
            "CCTV_PROBLEM",

          label:
            "CCTV Problem"
        },

        {
          id:
            "COMPUTER_LAPTOP",

          label:
            "Computer / Laptop"
        },

        {
          id:
            "JOB_ID_BILLING",

          label:
            "Job ID / Billing"
        },

        {
          id:
            "TECHNICIAN_SUPPORT",

          label:
            "Technician Support"
        },

        {
          id:
            "OTHER",

          label:
            "Other"
        }

      ],

      next_action:
        "SELECT_CATEGORY"

    };

  }


  /* =====================================================
     CATEGORY
     ===================================================== */

  if (
    action === "SELECT_CATEGORY"
  ) {

    switch (
      category
    ) {

      /* ===============================================
         CCTV
         =============================================== */

      case "CCTV_PROBLEM":

        return {

          message:
            "Please select the CCTV problem you are facing.",

          options: [

            {
              id:
                "CAMERA_OFFLINE",

              label:
                "Camera Offline"
            },

            {
              id:
                "NO_DISPLAY",

              label:
                "No Display"
            },

            {
              id:
                "RECORDING_PROBLEM",

              label:
                "Recording Problem"
            },

            {
              id:
                "NETWORK_PROBLEM",

              label:
                "Network Problem"
            },

            {
              id:
                "REMOTE_VIEWING",

              label:
                "Remote Viewing"
            },

            {
              id:
                "OTHER",

              label:
                "Other"
            }

          ],

          next_action:
            "SELECT_SUBCATEGORY"

        };


      /* ===============================================
         OTHER CATEGORIES
         =============================================== */

      case "TECHNICAL_PROBLEM":

        return {

          message:
            "Please describe the technical problem you are facing. I’ll help you identify the next step.",

          options: [

            {
              id:
                "CREATE_SUPPORT_REQUEST",

              label:
                "Create Support Request"
            }

          ],

          next_action:
            "TECHNICAL_PROBLEM"

        };


      case "APPOINTMENT_JOB":

        return {

          message:
            "What do you need help with regarding your appointment or job?",

          options: [

            {
              id:
                "CREATE_SUPPORT_REQUEST",

              label:
                "Create Support Request"
            }

          ],

          next_action:
            "APPOINTMENT_JOB"

        };


      case "COMPUTER_LAPTOP":

        return {

          message:
            "Please select how you would like to proceed with your Computer / Laptop problem.",

          options: [

            {
              id:
                "CREATE_SUPPORT_REQUEST",

              label:
                "Create Support Request"
            }

          ],

          next_action:
            "COMPUTER_LAPTOP"

        };


      case "JOB_ID_BILLING":

        return {

          message:
            "Please select how you would like to proceed with your Job ID or Billing issue.",

          options: [

            {
              id:
                "CREATE_SUPPORT_REQUEST",

              label:
                "Create Support Request"
            }

          ],

          next_action:
            "JOB_ID_BILLING"

        };


      case "TECHNICIAN_SUPPORT":

        return {

          message:
            "Please select how you would like to proceed with Technician Support.",

          options: [

            {
              id:
                "CREATE_SUPPORT_REQUEST",

              label:
                "Create Support Request"
            }

          ],

          next_action:
            "TECHNICIAN_SUPPORT"

        };


      case "OTHER":

        return {

          message:
            "This issue may require direct support from the Click & Fix team.",

          options: [

            {
              id:
                "CREATE_SUPPORT_REQUEST",

              label:
                "Create Support Request"
            }

          ],

          next_action:
            "OTHER"

        };


      default:

        return {

          message:
            "Please select a valid support category.",

          options: [

            {
              id:
                "START",

              label:
                "Start Again"
            }

          ],

          next_action:
            "START"

        };

    }

  }


  /* =====================================================
     CCTV SUBCATEGORY
     ===================================================== */

  if (
    action === "SELECT_SUBCATEGORY" &&
    category === "CCTV_PROBLEM"
  ) {

    switch (
      subcategory
    ) {


      /* ===============================================
         CAMERA OFFLINE
         =============================================== */

      case "CAMERA_OFFLINE":

        return {

          message:
            "Please check whether the camera has power and whether its network cable is firmly connected. If it is an IP camera, also check the PoE port or network switch connection.",

          options: [

            {
              id:
                "YES",

              label:
                "Issue Resolved"
            },

            {
              id:
                "NO",

              label:
                "Issue Not Resolved"
            }

          ],

          next_action:
            "CHECK_RESOLUTION"

        };


      /* ===============================================
         NO DISPLAY
         =============================================== */

      case "NO_DISPLAY":

        return {

          message:
            "Please check the HDMI/VGA cable between the NVR/DVR and monitor, make sure the monitor is on the correct input source, and restart the display device if necessary.",

          options: [

            {
              id:
                "YES",

              label:
                "Issue Resolved"
            },

            {
              id:
                "NO",

              label:
                "Issue Not Resolved"
            }

          ],

          next_action:
            "CHECK_RESOLUTION"

        };


      /* ===============================================
         RECORDING PROBLEM
         =============================================== */

      case "RECORDING_PROBLEM":

        return {

          message:
            "Please check whether the NVR/DVR shows a hard-disk warning and whether the recording schedule is enabled. If the storage status shows an error, the recording problem may require technical inspection.",

          options: [

            {
              id:
                "YES",

              label:
                "Issue Resolved"
            },

            {
              id:
                "NO",

              label:
                "Issue Not Resolved"
            }

          ],

          next_action:
            "CHECK_RESOLUTION"

        };


      /* ===============================================
         NETWORK PROBLEM
         =============================================== */

      case "NETWORK_PROBLEM":

        return {

          message:
            "Please check the LAN cable, router/switch connection and network indicator lights. If the CCTV system is connected through a network switch, make sure the switch is powered on.",

          options: [

            {
              id:
                "YES",

              label:
                "Issue Resolved"
            },

            {
              id:
                "NO",

              label:
                "Issue Not Resolved"
            }

          ],

          next_action:
            "CHECK_RESOLUTION"

        };


      /* ===============================================
         REMOTE VIEWING
         =============================================== */

      case "REMOTE_VIEWING":

        return {

          message:
            "Please check whether the NVR/DVR has an active network connection and whether the device shows an online status. Also check whether the mobile application is connected to the correct device.",

          options: [

            {
              id:
                "YES",

              label:
                "Issue Resolved"
            },

            {
              id:
                "NO",

              label:
                "Issue Not Resolved"
            }

          ],

          next_action:
            "CHECK_RESOLUTION"

        };


      /* ===============================================
         CCTV OTHER
         =============================================== */

      case "OTHER":

        return {

          message:
            "This CCTV issue may require technical inspection. Would you like to create a Support Request?",

          options: [

            {
              id:
                "CREATE_SUPPORT_REQUEST",

              label:
                "Create Support Request"
            }

          ],

          next_action:
            "CREATE_SUPPORT_REQUEST"

        };


      default:

        return {

          message:
            "Please select a valid CCTV problem.",

          options: [

            {
              id:
                "SELECT_CATEGORY",

              label:
                "Back"
            }

          ],

          next_action:
            "SELECT_CATEGORY"

        };

    }

  }


  /* =====================================================
     RESOLUTION CHECK
     ===================================================== */

  if (
    action === "CHECK_RESOLUTION"
  ) {

    if (
      subcategory === "YES"
    ) {

      return {

        message:
          "Great! The issue appears to be resolved. Would you like to close this support flow?",

        options: [

          {
            id:
              "YES",

            label:
              "Yes, Close"
          },

          {
            id:
              "NO",

            label:
              "No"
          }

        ],

        next_action:
          "CLOSE_FLOW"

      };

    }


    if (
      subcategory === "NO"
    ) {

      return {

        message:
          "The issue could not be resolved using the basic troubleshooting steps. Please create a Support Request so the Click & Fix team can assist you.",

        options: [

          {
            id:
              "CREATE_SUPPORT_REQUEST",

            label:
              "Create Support Request"
          }

        ],

        next_action:
          "CREATE_SUPPORT_REQUEST"

      };

    }

  }


  /* =====================================================
     CLOSE FLOW
     ===================================================== */

  if (
    action === "CLOSE_FLOW"
  ) {

    if (
      subcategory === "YES"
    ) {

      return {

        message:
          "Great! Your issue has been resolved. You can start a new Support Request anytime if another problem occurs.",

        options: [

          {
            id:
              "START",

            label:
              "Start Again"
          }

        ],

        next_action:
          "END"

      };

    }


    if (
      subcategory === "NO"
    ) {

      return {

        message:
          "No problem. You can continue troubleshooting or create a Support Request if you need assistance.",

        options: [

          {
            id:
              "START",

            label:
              "Back to Support"
          }

        ],

        next_action:
          "START"

      };

    }

  }


  /* =====================================================
     FALLBACK
     ===================================================== */

  return {

    message:
      "I could not determine the next step. Please start the support flow again.",

    options: [

      {
        id:
          "START",

        label:
          "Start Again"
      }

    ],

    next_action:
      "START"

  };

}


/* =========================================================
   SUPPORT BOT MESSAGE
   SAVE BOT MESSAGE TO SUPPORT CHAT
   ========================================================= */

async function supportBotMessage(
  db: any,
  technicianId: string,
  body: any
) {

  if (
    !isUuid(technicianId)
  ) {

    throw new Error(
      "Invalid technician."
    );

  }


  const requestId =
    String(
      body?.support_request_id ||
      ""
    ).trim();


  const message =
    String(
      body?.message ||
      ""
    ).trim();


  if (
    !requestId ||
    !isUuid(requestId)
  ) {

    throw new Error(
      "Invalid support request."
    );

  }


  if (!message) {

    throw new Error(
      "Bot message is required."
    );

  }


  if (
    message.length > 2000
  ) {

    throw new Error(
      "Bot message cannot exceed 2000 characters."
    );

  }


  /*
   * Verify ownership.
   */

  const {
    data: supportRequest,
    error: supportRequestError
  } = await db
    .from("support_requests")
    .select(`
      id,
      technician_id,
      status
    `)
    .eq(
      "id",
      requestId
    )
    .eq(
      "technician_id",
      technicianId
    )
    .maybeSingle();


  if (
    supportRequestError
  ) {

    console.error(
      "BOT MESSAGE REQUEST VERIFY ERROR:",
      supportRequestError.message
    );

    throw new Error(
      "SUPPORT_REQUEST_VERIFY_FAILED"
    );

  }


  if (
    !supportRequest
  ) {

    throw new Error(
      "SUPPORT_REQUEST_NOT_FOUND"
    );

  }


  /*
   * BOT is allowed to remain available
   * even when the human composer is disabled.
   *
   * Therefore CLOSED requests are NOT blocked here.
   *
   * CANCELLED requests are also kept
   * read-only for human chat.
   */


  /*
   * IMPORTANT:
   * sender_type is NEVER accepted
   * from the frontend.
   *
   * It is always forced to BOT.
   */

  const {
    data,
    error
  } = await db
    .from("support_messages")
    .insert({

      support_request_id:
        requestId,

      sender_type:
        "BOT",

      sender_user_id:
        null,

      message:
        message

    })
    .select(`
      id,
      support_request_id,
      sender_type,
      sender_user_id,
      message,
      created_at
    `)
    .single();


  if (error) {

    console.error(
      "SUPPORT BOT MESSAGE INSERT ERROR:",
      {
        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,

        code:
          error.code
      }
    );

    throw new Error(
      `SUPPORT_BOT_MESSAGE_SAVE_FAILED: ${
        error.message ||
        "Database insert failed."
      }`
    );

  }


  return {

    message:
      data

  };

}

/* =========================================================
   SUPPORT TOKEN GENERATOR
   FORMAT:
   CFS-2026-XXXXX
   ========================================================= */

function generateSupportToken() {

  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  const values =
    new Uint32Array(5);

  crypto.getRandomValues(
    values
  );


  let randomPart = "";


  for (
    let i = 0;
    i < 5;
    i++
  ) {

    randomPart +=
      characters[
        values[i] %
        characters.length
      ];

  }


  return (
    `CFS-${new Date().getFullYear()}-${randomPart}`
  );
}


/* =========================================================
   SET STATUS
   ========================================================= */

async function setStatus(
  db: any,
  technicianId: string,
  body: any
) {

  if (
    !isUuid(body.id)
  ) {
    throw new Error(
      "Invalid appointment."
    );
  }

  const {
    data,
    error
  } = await db.rpc(
    "technician_set_status",
    {
      appointment_uuid:
        body.id,

      technician_uuid:
        technicianId,

      new_status:
        body.status,

      note_input:
        text(
          body.note,
          1000
        ),

      job_code_input:
        body.job_code ||
        null
    }
  );

  if (error) {
    throw new Error(
      error.message
    );
  }

  return {
    appointment:
      data
  };
}


/* =========================================================
   START COMPLETION OTP
   ========================================================= */

async function startCompletion(
  db: any,
  technician: any,
  appointmentId: string
) {

  if (
    !isUuid(appointmentId)
  ) {
    throw new Error(
      "Invalid appointment."
    );
  }

  const {
    data: appointment,
    error
  } = await db
    .from("appointments")
    .select(
      "id,customer_name,email,status,technician_id"
    )
    .eq(
      "id",
      appointmentId
    )
    .eq(
      "technician_id",
      technician.id
    )
    .single();

  if (
    error ||
    !appointment
  ) {
    throw new Error(
      "Assigned appointment not found."
    );
  }

  if (
    ![
      "in_progress",
      "job_id_created"
    ].includes(
      appointment.status
    )
  ) {
    throw new Error(
      "Completion can begin only when work is In Progress or Job ID Created."
    );
  }

  if (
    !appointment.email
  ) {
    throw new Error(
      "The appointment has no registered customer email."
    );
  }

  const {
    data: active
  } = await db
    .from("completion_otps")
    .select(
      "id,last_sent_at"
    )
    .eq(
      "appointment_id",
      appointment.id
    )
    .eq(
      "technician_id",
      technician.id
    )
    .is(
      "used_at",
      null
    )
    .is(
      "invalidated_at",
      null
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    )
    .limit(1)
    .maybeSingle();

  if (
    active &&
    Date.now() -
      new Date(
        active.last_sent_at
      ).getTime() <
      60000
  ) {
    throw new Error(
      "Please wait 60 seconds before requesting another OTP."
    );
  }

  if (active) {

    await db
      .from("completion_otps")
      .update({
        invalidated_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        active.id
      );
  }

  const otp =
    randomOtp();

  const hash =
    await otpHash(
      otp
    );

  const now =
    new Date();

  const expires =
    new Date(
      now.getTime() +
        10 * 60 * 1000
    ).toISOString();

  const {
    error: insertError
  } = await db
    .from("completion_otps")
    .insert({

      appointment_id:
        appointment.id,

      technician_id:
        technician.id,

      otp_hash:
        hash,

      expires_at:
        expires,

      last_sent_at:
        now.toISOString()
    });

  if (insertError) {
    throw new Error(
      "Could not start verification."
    );
  }

  try {

    await sendOtpEmail(
      appointment.email,
      otp
    );

    await db
      .from("notifications")
      .insert({

        appointment_id:
          appointment.id,

        channel:
          "brevo",

        type:
          "completion_otp",

        status:
          "sent",

        sent_at:
          new Date().toISOString()
      });

  } catch (_) {

    await db
      .from("completion_otps")
      .update({
        invalidated_at:
          new Date().toISOString()
      })
      .eq(
        "appointment_id",
        appointment.id
      )
      .eq(
        "technician_id",
        technician.id
      )
      .is(
        "used_at",
        null
      );

    await db
      .from("notifications")
      .insert({

        appointment_id:
          appointment.id,

        channel:
          "brevo",

        type:
          "completion_otp",

        status:
          "failed",

        error:
          "OTP email delivery failed"
      });

    throw new Error(
      "The verification email could not be sent. Please try again."
    );
  }

  return {

    verification_required:
      true,

    expires_at:
      expires,

    resend_available_at:
      new Date(
        now.getTime() +
          60000
      ).toISOString()
  };
}


/* =========================================================
   VERIFY COMPLETION OTP
   ========================================================= */

async function verifyCompletion(
  db: any,
  technician: any,
  appointmentId: string,
  otp: string
) {

  if (
    !isUuid(appointmentId)
  ) {
    throw new Error(
      "Invalid appointment."
    );
  }

  if (
    !/^\d{6}$/.test(
      otp || ""
    )
  ) {
    throw new Error(
      "Enter the 6-digit OTP."
    );
  }

  const {
    data,
    error
  } = await db.rpc(
    "consume_completion_otp",
    {
      appointment_uuid:
        appointmentId,

      technician_uuid:
        technician.id,

      candidate_hash:
        await otpHash(
          otp
        )
    }
  );

  if (error) {
    throw new Error(
      "Verification could not be completed."
    );
  }

  if (!data) {
    throw new Error(
      "The OTP is invalid, expired, or has reached its attempt limit."
    );
  }

  return {
    completed:
      true
  };
}


/* =========================================================
   UUID VALIDATION
   ========================================================= */

function isUuid(
  value: unknown
) {

  return (
    typeof value === "string" &&
    /^[0-9a-f-]{36}$/i.test(
      value
    )
  );
}


/* =========================================================
   OTP GENERATOR
   ========================================================= */

function randomOtp() {

  const values =
    new Uint32Array(1);

  const upper =
    Math.floor(
      0x100000000 /
        1000000
    ) *
    1000000;

  do {

    crypto.getRandomValues(
      values
    );

  } while (
    values[0] >= upper
  );

  return String(
    values[0] %
      1000000
  ).padStart(
    6,
    "0"
  );
}


/* =========================================================
   OTP HASH
   ========================================================= */

async function otpHash(
  otp: string
) {

  const pepper =
    Deno.env.get(
      "OTP_HASH_PEPPER"
    );

  if (!pepper) {
    throw new Error(
      "OTP service is not configured."
    );
  }

  const bytes =
    new TextEncoder().encode(
      `${pepper}:${otp}`
    );

  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return Array
    .from(
      new Uint8Array(hash)
    )
    .map(
      value =>
        value
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");
}


/* =========================================================
   SEND OTP EMAIL
   ========================================================= */

async function sendOtpEmail(
  email: string,
  otp: string
) {

  const key =
    Deno.env.get(
      "BREVO_API_KEY"
    );

  const sender =
    Deno.env.get(
      "BREVO_SENDER_EMAIL"
    );

  if (
    !key ||
    !sender
  ) {
    throw new Error(
      "OTP email service is not configured."
    );
  }

  const response =
    await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json",

          "api-key":
            key
        },

        body:
          JSON.stringify({

            sender: {

              email:
                sender,

              name:
                "Click & Fix Technologies"
            },

            to: [
              {
                email
              }
            ],

            subject:
              "Click & Fix Technologies – Service Completion Verification OTP",

            htmlContent:
              `<p>Your service completion verification OTP is:</p>
               <h2>${otp}</h2>
               <p>Please provide this OTP to the technician to confirm completion of your service.</p>
               <p>This OTP is valid for 10 minutes.</p>`
          })
      }
    );

  if (!response.ok) {
    throw new Error(
      "OTP email delivery failed."
    );
  }
}


/* =========================================================
   TEXT HELPER
   ========================================================= */

function text(
  value: unknown,
  limit: number
) {

  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(
          0,
          limit
        )
    : null;
}