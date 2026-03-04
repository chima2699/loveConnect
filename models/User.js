const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    /* ================= CORE AUTH ================= */
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    isAdmin: {
      type: Boolean,
      default: false,
      index: true
    },

    /* ================= PHONE + OTP ================= */
    phone: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },

    phoneVerified: {
      type: Boolean,
      default: false,
      index: true
    },

    paymentRegion: {
      type: String,
      enum: ["NG", "FOREIGN"],
      default: "NG"
    },

    otpHash: String,
    otpExpiresAt: Date,
    otpAttempts: {
      type: Number,
      default: 0
    },

    /* ================= WALLET ================= */
    bonusCoins: {
      type: Number,
      default: 0
    },

    purchasedCoins: {
      type: Number,
      default: 0
    },

    /* ================= PROFILE ================= */
    fullname: {
      type: String,
      default: "",
      trim: true
    },

    age: {
      type: Number,
      default: null
    },

    gender: {
      type: String,
      enum: ["male", "female", "both", "any"],
      default: "any"
    },

    interestedIn: {
      type: String,
      enum: ["male", "female", "both", "any"],
      default: "any"
    },

    location: {
      type: String,
      default: "",
      trim: true
    },

    interests: {
      type: String,
      default: ""
    },

    goal: {
      type: String,
      default: ""
    },

    bio: {
      type: String,
      default: ""
    },

    /* ================= MEDIA ================= */
    profilePhoto: {
      type: String,
      default: null
    },

    photos: {
      type: [String],
      default: []
    },

    /* ================= GEO LOCATION ================= */
    lat: {
      type: Number,
      default: null
    },

    lon: {
      type: Number,
      default: null
    },

    /* ================= SOCIAL ================= */
    followers: {
      type: [String],
      default: []
    },

    following: {
      type: [String],
      default: []
    },

    /* ================= ACCOUNT STATUS ================= */
    banned: {
      type: Boolean,
      default: false,
      index: true
    },

    suspendedUntil: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

/* ================= VIRTUALS ================= */

UserSchema.virtual("totalCoins").get(function () {
  return (this.bonusCoins || 0) + (this.purchasedCoins || 0);
});

/* ================= NORMALIZATION ================= */

UserSchema.pre("save", function () {
  if (this.gender) {
    this.gender = this.gender.toLowerCase();
  }

  if (this.interestedIn) {
    this.interestedIn = this.interestedIn.toLowerCase();
  }

});

module.exports = mongoose.model("User", UserSchema);
